import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { toSafeExternalUrl } from "./external-urls.js";
import { getRequestErrorMessage } from "./request-errors.js";
import DashboardNav from "./DashboardNav.jsx";
import PortfolioProject from "./PortfolioProject.jsx";

function Portfolio() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadItems() {
      const result = await supabase.from("portfolio_items").select("*")
        .eq("freelancer_id", user.id).order("created_at", { ascending: false });
      if (!active) return;
      if (result.error) setError(getRequestErrorMessage("Unable to load portfolio", result.error));
      else setItems(result.data || []);
      setLoading(false);
    }
    loadItems().catch((loadError) => {
      if (!active) return;
      setError(getRequestErrorMessage("Unable to load portfolio", loadError));
      setLoading(false);
    });
    return () => { active = false; };
  }, [user.id]);

  function clearForm() {
    setEditingId("");
    setTitle("");
    setDescription("");
    setProjectUrl("");
    setImageUrl("");
  }

  function editItem(item) {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description || "");
    setProjectUrl(item.project_url);
    setImageUrl(item.image_url || "");
    setError("");
    document.getElementById("portfolio-title")?.focus();
  }

  async function saveItem(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const itemDetails = {
      title: title.trim(),
      description: description.trim(),
      project_url: toSafeExternalUrl(projectUrl),
      image_url: imageUrl.trim() ? toSafeExternalUrl(imageUrl) : null,
      updated_at: new Date().toISOString()
    };

    if (!itemDetails.project_url) {
      setError("Enter a valid project URL starting with http:// or https://.");
      setSaving(false);
      return;
    }
    if (imageUrl.trim() && !itemDetails.image_url) {
      setError("Enter a valid image URL starting with http:// or https://.");
      setSaving(false);
      return;
    }

    try {
      const result = editingId
        ? await supabase.from("portfolio_items").update(itemDetails)
          .eq("id", editingId).eq("freelancer_id", user.id).select("*").single()
        : await supabase.from("portfolio_items").insert({ ...itemDetails, freelancer_id: user.id })
          .select("*").single();
      if (result.error) throw result.error;
      if (editingId) {
        setItems((current) => current.map((item) => item.id === editingId ? result.data : item));
      } else {
        setItems((current) => [result.data, ...current]);
      }
      clearForm();
    } catch (saveError) {
      setError(getRequestErrorMessage(`Unable to ${editingId ? "save" : "add"} portfolio item`, saveError));
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(item) {
    if (!window.confirm(`Delete “${item.title}” from your portfolio?`)) return;

    setDeletingId(item.id);
    setError("");
    try {
      const result = await supabase.from("portfolio_items").delete()
        .eq("id", item.id).eq("freelancer_id", user.id).select("id").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("This portfolio item could not be found.");
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      if (editingId === item.id) clearForm();
    } catch (deleteError) {
      setError(getRequestErrorMessage("Unable to delete portfolio item", deleteError));
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="dashboard-page">
      <DashboardNav user={user} />
      <main className="dashboard-container">
        <div className="dashboard-welcome">
          <span className="dashboard-tag">SHOW YOUR WORK</span>
          <h1>Portfolio</h1>
          <p>Add selected projects so clients can see what you do best.</p>
          <Link to={`/profiles/${user.id}#portfolio-projects`}>Preview portfolio</Link>
        </div>
        <section className="dashboard-section portfolio-editor">
          <h2>{editingId ? "Edit project" : "Add a project"}</h2>
          <form className="application-form" onSubmit={saveItem}>
            {error && <p role="alert">{error}</p>}
            <label htmlFor="portfolio-title">Project title</label>
            <input id="portfolio-title" maxLength={120} required value={title} onChange={(event) => setTitle(event.target.value)} />
            <label htmlFor="portfolio-description">Description</label>
            <textarea id="portfolio-description" maxLength={3000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
            <label htmlFor="portfolio-url">Project link</label>
            <input id="portfolio-url" type="url" pattern="https?://.+" placeholder="https://example.com/project" required value={projectUrl} onChange={(event) => setProjectUrl(event.target.value)} />
            <label htmlFor="portfolio-image">Preview image URL (optional)</label>
            <input id="portfolio-image" type="url" pattern="https?://.+" placeholder="https://example.com/image.jpg" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
            <div className="portfolio-form-actions">
              <button type="submit" className="primary-btn" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add to Portfolio"}</button>
              {editingId && <button type="button" className="portfolio-cancel-button" disabled={saving} onClick={clearForm}>Cancel</button>}
            </div>
          </form>
        </section>
        <section aria-labelledby="portfolio-owner-projects">
          <h2 id="portfolio-owner-projects">Portfolio projects</h2>
          <div className="portfolio-grid">
            {loading ? <p role="status">Loading portfolio…</p> : items.length === 0 ? <p>No portfolio projects yet.</p> : items.map((item) => (
              <PortfolioProject project={item} key={item.id}>
                <div className="portfolio-card-actions">
                  <button type="button" className="portfolio-edit-button" disabled={saving || Boolean(deletingId)} onClick={() => editItem(item)}>Edit</button>
                  <button type="button" className="portfolio-delete-button" disabled={saving || Boolean(deletingId)} onClick={() => deleteItem(item)}>{deletingId === item.id ? "Deleting…" : "Delete"}</button>
                </div>
              </PortfolioProject>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Portfolio;
