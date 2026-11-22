import { useState } from "react";
import { toSafeExternalUrl } from "./external-urls.js";
import "./profile-preview.css";

function ProjectImage({ src }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img className="profile-project-image" src={src} alt="" loading="lazy" decoding="async"
    referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

export default function PortfolioProject({ project, children }) {
  const image = toSafeExternalUrl(project.image_url);
  const href = toSafeExternalUrl(project.project_url);
  return (
    <article className="portfolio-card profile-project">
      {image && <ProjectImage key={image} src={image} />}
      <div className="profile-project-body">
        <h3>{project.title}</h3>
        {project.description && <p>{project.description}</p>}
        {href && <a className="profile-preview-link" href={href} target="_blank" rel="noopener noreferrer"
          aria-label={`Open project: ${project.title} (opens in a new tab)`}>Open project <span aria-hidden="true">↗</span></a>}
        {children}
      </div>
    </article>
  );
}
