import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { toSafeExternalUrl } from "./external-urls.js";
import { DELIVERY_BUCKET, deliveryActions, deliveryDraftError, isDuplicateDeliveryUpload, makeDeliveryRequest } from "./delivery-workflow.js";

const emptyDraft = { description: "", project: "", files: [] };
const statusLabels = { submitted: "Awaiting client review", revision_requested: "Revision requested", approved: "Work accepted" };
const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const pageSize = 20;
const deliveryFields = "id,version,description,project_url,attachment_paths,submitted_at,status,decided_at,feedback";

async function listDeliveries(contractId, before) {
  let query = supabase.from("contract_deliveries").select(deliveryFields)
    .eq("contract_id", contractId).order("version", { ascending: false }).limit(pageSize + 1);
  if (before) query = query.lt("version", before);
  const { data, error } = await query;
  if (error) throw error;
  return { rows: data.slice(0, pageSize), more: data.length > pageSize };
}

function DeliveryVersion({ delivery, onDownload, downloading }) {
  const project = toSafeExternalUrl(delivery.project_url);
  return <li className="delivery-version">
    <div className="delivery-version-head">
      <h3>Version {delivery.version}</h3><span className="workroom-badge">{statusLabels[delivery.status]}</span>
    </div>
    <time className="journey-muted" dateTime={delivery.submitted_at}>Submitted {date.format(new Date(delivery.submitted_at))}</time>
    <p className="delivery-description">{delivery.description}</p>
    {project && <p><a href={project} target="_blank" rel="noopener noreferrer">Open project link (new tab)</a></p>}
    {delivery.attachment_paths.length > 0 && <ul className="delivery-files" aria-label={`Version ${delivery.version} attachments`}>
      {delivery.attachment_paths.map((path, index) => <li key={path}>
        <button type="button" className="journey-button journey-secondary" disabled={downloading}
          onClick={() => onDownload(path)}>Download attachment {index + 1} ({path.split(".").at(-1).toUpperCase()})</button>
      </li>)}
    </ul>}
    {delivery.decided_at && <p className="journey-muted">Decision recorded <time dateTime={delivery.decided_at}>{date.format(new Date(delivery.decided_at))}</time></p>}
    {delivery.feedback && <div className="delivery-feedback"><strong>Client feedback</strong><p className="delivery-description">{delivery.feedback}</p></div>}
  </li>;
}

export default function ContractDeliveries({ contract, userId }) {
  const [generation, reload] = useState(0);
  const [snapshot, setSnapshot] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [retryingDraft, setRetryingDraft] = useState(false);
  const lock = useRef(false);
  const pending = useRef(null);
  const fileInput = useRef(null);
  const current = snapshot?.generation === generation ? snapshot : null;
  const latest = current?.rows?.[0];
  const actions = deliveryActions(contract, userId, latest);

  useEffect(() => {
    let live = true;
    listDeliveries(contract.id).then((data) => {
      if (live) setSnapshot({ generation, ...data });
    }, (failure) => {
      if (live) setSnapshot({ generation, unavailable: ["42P01", "PGRST205"].includes(failure?.code), failed: true });
    });
    return () => { live = false; };
  }, [contract.id, generation]);

  function clearPending() {
    pending.current = null;
    setRetryingDraft(false);
  }

  async function run(action, fallback, operation) {
    if (lock.current) return;
    lock.current = true;
    setBusy(action);
    setMessage("");
    setError("");
    try {
      await operation();
    } catch (failure) {
      if (failure?.code === "PT409") {
        clearPending();
        setError("The delivery changed. Check the latest version before trying again.");
        reload((value) => value + 1);
      } else if (failure?.code === "22023" || failure?.code === "42501") {
        clearPending();
        setError("The action was rejected. Check your permissions and delivery details.");
      } else {
        setError(fallback);
      }
    } finally {
      lock.current = false;
      setBusy("");
    }
  }

  function submit(event) {
    event.preventDefault();
    if (lock.current || !current?.rows || !actions.submit) return;
    const validation = deliveryDraftError(draft.description, draft.project, draft.files);
    if (validation) { setError(validation); return; }
    void run("submit", "Delivery could not be confirmed. Your draft is saved on this page. Retry the same submission.", async () => {
      const request = pending.current ??= makeDeliveryRequest(contract.id, userId, crypto.randomUUID(), latest?.id ?? null, draft);
      setRetryingDraft(true);
      for (const { path, file } of request.files) {
        if (request.uploaded.has(path)) continue;
        const { error: uploadError } = await supabase.storage.from(DELIVERY_BUCKET).upload(path, file, {
          upsert: false, contentType: file.type, cacheControl: "0"
        });
        if (uploadError && !isDuplicateDeliveryUpload(uploadError)) throw uploadError;
        request.uploaded.add(path);
      }
      const { error: submitError } = await supabase.rpc("techkarvo_submit_delivery", request.payload);
      if (submitError) throw submitError;
      clearPending();
      setDraft(emptyDraft);
      if (fileInput.current) fileInput.current.value = "";
      setMessage("Delivery submitted for client review.");
      reload((value) => value + 1);
    });
  }

  function decide(decision) {
    if (!current?.rows || !actions.decide || lock.current) return;
    if (decision === "revision_requested" && !feedback.trim()) {
      setError("Enter feedback describing what needs to change.");
      document.getElementById("delivery-feedback")?.focus();
      return;
    }
    void run("decide", "Decision could not be confirmed. Try the same decision again.", async () => {
      const { error: decisionError } = await supabase.rpc("techkarvo_decide_delivery", {
        p_contract_id: contract.id, p_delivery_id: latest.id, p_decision: decision,
        p_feedback: decision === "revision_requested" ? feedback.trim() : null
      });
      if (decisionError) throw decisionError;
      setFeedback("");
      setMessage(decision === "approved" ? "Work accepted." : "Revision requested.");
      reload((value) => value + 1);
    });
  }

  function download(path) {
    void run("download", "The private download is unavailable. Try again to get a new link.", async () => {
      const { data, error: downloadError } = await supabase.storage.from(DELIVERY_BUCKET).createSignedUrl(path, 60, { download: true });
      const href = toSafeExternalUrl(data?.signedUrl);
      if (downloadError || !href) throw downloadError ?? new Error("Missing signed URL");
      const link = document.createElement("a");
      link.href = href;
      link.rel = "noreferrer";
      link.click();
    });
  }

  function showOlder() {
    void run("history", "Older deliveries could not be loaded. Try again.", async () => {
      const { rows, more } = await listDeliveries(contract.id, current.rows.at(-1).version);
      setSnapshot({ generation, rows: [...current.rows, ...rows], more });
    });
  }

  return <section className="journey-panel workroom-section workroom-deliveries" aria-labelledby="workroom-delivery-heading">
    <header>
      <h2 id="workroom-delivery-heading">Work delivery</h2>
      <p className="journey-muted">Accepting a delivery records work approval. Contract completion and sandbox payment have separate statuses.</p>
      {snapshot?.rows && <button type="button" className="journey-button journey-secondary" aria-disabled={Boolean(busy) || !current}
        onClick={() => { if (current && !lock.current) reload((value) => value + 1); }}>Check for new deliveries</button>}
    </header>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!current && <p role="status">Loading deliveries…</p>}
    {current?.failed && <div>
      <p role="alert">{current.unavailable ? "Work delivery is unavailable in this environment." : "Could not load deliveries."}</p>
      <button type="button" className="journey-button journey-secondary" onClick={() => reload((value) => value + 1)}>Reload deliveries</button>
    </div>}
    {current?.rows && <>
      {contract.status !== "active" && <p className="journey-muted">Delivery history is read-only while this contract is {contract.status}.</p>}
      {current.rows.length === 0 && <p>No work has been submitted.</p>}
      {actions.submit && <form className="delivery-form" onSubmit={submit} aria-labelledby="delivery-form-heading">
        <h3 id="delivery-form-heading">{latest ? "Submit revised work" : "Submit work"}</h3>
        <label htmlFor="delivery-description">Delivery description</label>
        <textarea id="delivery-description" rows="4" maxLength={5000} required value={draft.description} readOnly={retryingDraft}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        <label htmlFor="delivery-project">Project link (optional)</label>
        <input id="delivery-project" inputMode="url" maxLength={2048} value={draft.project} readOnly={retryingDraft}
          onChange={(event) => setDraft({ ...draft, project: event.target.value })} />
        <label htmlFor="delivery-files">Private attachments (optional)</label>
        <p id="delivery-file-hint" className="journey-muted">Up to three PDF, PNG, or JPEG files. Maximum 5 MiB each.</p>
        <input id="delivery-files" ref={fileInput} type="file" multiple accept="application/pdf,image/png,image/jpeg"
          aria-describedby="delivery-file-hint" disabled={retryingDraft}
          onChange={(event) => setDraft({ ...draft, files: Array.from(event.target.files) })} />
        {draft.files.length > 0 && <p className="delivery-description">{draft.files.map((file) => file.name).join(", ")}</p>}
        <div className="journey-actions">
          <button className="journey-button" disabled={Boolean(busy)}>{busy === "submit" ? "Submitting…" : retryingDraft ? "Retry submission" : "Submit delivery"}</button>
          {retryingDraft && !busy && <button type="button" className="journey-button journey-secondary" onClick={() => {
            clearPending();
            reload((value) => value + 1);
            setError("");
          }}>Check status and edit draft</button>}
        </div>
      </form>}
      {current.rows.length > 0 && <ol className="delivery-history" aria-label="Delivery history">
        {current.rows.map((delivery) => <DeliveryVersion key={delivery.id} delivery={delivery} onDownload={download} downloading={Boolean(busy)} />)}
      </ol>}
      {actions.decide && <form className="delivery-form" onSubmit={(event) => { event.preventDefault(); decide("revision_requested"); }}>
        <h3>Review version {latest.version}</h3>
        <label htmlFor="delivery-feedback">Feedback for revision requests</label>
        <textarea id="delivery-feedback" value={feedback} rows="3" maxLength={3000}
          onChange={(event) => setFeedback(event.target.value)} />
        <div className="journey-actions">
          <button type="button" className="journey-button" disabled={Boolean(busy)} onClick={() => decide("approved")}>Accept work</button>
          <button type="submit" className="journey-button journey-secondary" disabled={Boolean(busy)}>Request revision</button>
        </div>
      </form>}
      {current.more && <button type="button" className="journey-button journey-secondary" disabled={Boolean(busy)} onClick={showOlder}>Load older versions</button>}
    </>}
  </section>;
}
