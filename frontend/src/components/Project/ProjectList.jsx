import { Link } from "react-router-dom";
import { deleteProject } from "../../services/project.service";

export default function ProjectList({ projects, reload }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {projects.map((p) => (
        <div key={p._id} className="border rounded p-4 shadow">
          <Link
            to={`/projects/${p._id}`}
            className="text-lg font-semibold text-blue-600"
          >
            {p.name}
          </Link>
          <button
            onClick={() => deleteProject(p._id).then(reload)}
            className="mt-2 text-red-500"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
