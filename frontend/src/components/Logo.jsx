export default function Logo({ light = false, size = "text-2xl" }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display ${size} ${light ? "text-white" : "text-leaf-800 dark:text-leaf-200"}`}>
      <span className="grid size-9 place-items-center rounded-xl bg-leaf-600 text-white shadow-md shadow-leaf-600/30">
        <i className="fa-solid fa-leaf text-base" />
      </span>
      Recipe<span className="text-tomato-500">Pick</span>
    </span>
  );
}
