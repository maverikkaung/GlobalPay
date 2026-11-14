import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCurrentUser } from "./auth.js";
import { supabase } from "./supabase.js";

function PostJob() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [budget, setBudget] = useState("");
  const [paymentType, setPaymentType] = useState("Fixed Price");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!user) {
      alert("Please log in first.");
      navigate("/login");
      return;
    }

    if (user.accountType !== "Client") {
      alert("Only Clients can post jobs.");
      return;
    }

    if (!user.id) {
      alert("User ID not found. Please log out and log in again.");
      return;
    }

    setLoading(true);

    const result = await supabase
      .from("jobs")
      .insert({
        client_id: user.id,
        title: title.trim(),
        category: category,
        description: description.trim(),
        skills: skills.trim(),
        budget: Number(budget),
        currency: "USD",
        payment_type: paymentType,
        status: "open"
      });

    setLoading(false);

    if (result.error) {
      alert("Job posting failed: " + result.error.message);
      return;
    }

    alert("Your job has been posted successfully!");
    navigate("/client-dashboard");
  }

  if (!user) {
    return (
      <div className="dashboard-page">
        <h2>Please log in to post a job.</h2>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  if (user.accountType !== "Client") {
    return (
      <div className="dashboard-page">
        <h2>Only Clients can post jobs.</h2>
        <Link to="/freelancer-dashboard">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-navbar">
        <Link to="/client-dashboard" className="dashboard-logo">
          TechKarvo
        </Link>

        <Link to="/client-dashboard" className="dashboard-logout">
          Back to Dashboard
        </Link>
      </header>

      <main className="dashboard-container">
        <div className="dashboard-welcome">
          <span className="dashboard-tag">POST A JOB</span>
          <h1>Find Your Perfect Freelancer</h1>
          <p>Describe your project and connect with talented people.</p>
        </div>

        <form className="application-form" onSubmit={handleSubmit}>
          <h2>Job Information</h2>

          <label>Job Title</label>
          <input
            type="text"
            placeholder="Example: React Developer Needed"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />

          <label>Job Category</label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            required
          >
            <option value="">Select Category</option>
            <option value="Web Development">Web Development</option>
            <option value="Graphic Design">Graphic Design</option>
            <option value="Writing">Writing</option>
            <option value="Marketing">Marketing</option>
            <option value="Video Editing">Video Editing</option>
            <option value="Other">Other</option>
          </select>

          <label>Job Description</label>
          <textarea
            placeholder="Describe the work and project requirements..."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
<label>Required Skills</label>
          <input
            type="text"
            placeholder="React, JavaScript, CSS..."
            value={skills}
            onChange={(event) => setSkills(event.target.value)}
            required
          />

          <h2>Budget Information</h2>

          <label>Budget (USD)</label>
          <input
            type="number"
            min="1"
            placeholder="Example: 500"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            required
          />

          <label>Payment Type</label>
          <select
            value={paymentType}
            onChange={(event) => setPaymentType(event.target.value)}
          >
            <option value="Fixed Price">Fixed Price</option>
            <option value="Hourly">Hourly</option>
          </select>

          <button
            type="submit"
            className="primary-btn"
            disabled={loading}
          >
            {loading ? "Publishing..." : "Publish Job"}
          </button>
        </form>
      </main>
    </div>
  );
}

export default PostJob;