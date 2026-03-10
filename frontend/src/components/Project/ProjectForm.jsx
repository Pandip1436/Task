import { useState } from "react";
import { createProject } from "../../services/project.service";

export default function ProjectForm({ onCreated }) {
  const [name, setName] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    await createProject({ name });
    setName("");
    onCreated();
  };

  return (
    <form onSubmit={submit} className="flex gap-2 mb-4">
      <input
        className="border p-2 rounded w-full"
        placeholder="Project name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button className="bg-blue-600 text-white px-4 rounded">
        Add
      </button>
    </form>
  );
}
