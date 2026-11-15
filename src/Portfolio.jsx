import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";

function Portfolio() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadItems() {
      const result = await supabase.from("portfolio_items").select("*")
        .eq("freelancer_id", user.id).order("created_at", { ascending: false });
      if (!active) return;
      if (result.error) setError("Unable to load portfolio. " + result.error.message);
      else setItems(result.data || []);
      setLoading(false);
    }
    loadItems().catch((loadError) => {
      if (!active) return;
      setError("Unable to load portfolio. " + loadError.message);
      setLoading(false);
    });
    return () => { active = false; };
  }, [user.id]);

  async function addItem(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const result = await supabase.from("portfolio_items").insert({
      freelancer_id: user.id,
      title: title.trim(),
      description: description.trim(),
      project_url: projectUrl.trim(),
      image_url: imageUrl.trim() || null
    }).select("*").single();
    setSaving(false);
    if (result.error) {
      setError("Unable to add portfolio item. " + result.error.message);
      return;
    }
    setItems((current) => [result.data, ...current]);
    setTitle("");
    setDescription("");
    setProjectUrl("");
    setImageUrl("");
  }

  const dashboard = "/freelancer-dashboard";

  return (
    <div className="dashboard-page">
      <header className="dashboard-navbar">
        <Link to={dashboard} className="dashboard-logo">TechKarvo</Link>
        <Link to={dashboard} className="dashboard-logout">Back to Dashboard</Link>
      </header>
      <main className="dashboard-container">
        <div className="dashboard-welcome">
          <span className="dashboard-tag">SHOW YOUR WORK</span>
          <h1>Portfolio</h1>
          <p>Add selected projects so clients can see what you do best.</p>
        </div>
        <section className="dashboard-section portfolio-editor">
          <h2>Add a project</h2>
          <form className="application-form" onSubmit={addItem}>
            {error && <p role="alert">{error}</p>}
            <label htmlFor="portfolio-title">Project title</label>
            <input id="portfolio-title" maxLength={120} required value={title} onChange={(event) => setTitle(event.target.value)} />
            <label htmlFor="portfolio-description">Description</label>
            <textarea id="portfolio-description" maxLength={3000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
            <label htmlFor="portfolio-url">Project link</label>
            <input id="portfolio-url" type="url" pattern="https?://.+" placeholder="https://example.com/project" required value={projectUrl} onChange={(event) => setProjectUrl(event.target.value)} />
            <label htmlFor="portfolio-image">Preview image URL (optional)</label>
            <input id="portfolio-image" type="url" pattern="https?://.+" placeholder="https://example.com/image.jpg" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
            <button type="submit" className="primary-btn" disabled={saving}>{saving ? "Adding…" : "Add to Portfolio"}</button>
          </form>
        </section>
        <section className="portfolio-grid" aria-label="Portfolio projects">
          {loading ? <p>Loading portfolio…</p> : items.length === 0 ? <div className="no-jobs"><h3>Your portfolio is ready to grow</h3><p>Add your first project above.</p></div> : items.map((item) => (
            <article className="portfolio-card" key={item.id}>
              {item.image_url && <img src={item.image_url} alt="" loading="lazy" />}
              <div><h2>{item.title}</h2><p>{item.description}</p><a href={item.project_url} target="_blank" rel="noreferrer">View project ↗</a></div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

export default Portfolio;
