export default function Hamburger({ open }) {
  return (
    <span className="relative block h-4 w-5" aria-hidden="true">
      <span className={`absolute left-0 h-0.5 w-5 rounded bg-current transition-all duration-300 ${open ? "top-1.5 rotate-45" : "top-0"}`} />
      <span className={`absolute top-1.5 left-0 h-0.5 w-5 rounded bg-current transition-all duration-200 ${open ? "translate-x-3 opacity-0" : ""}`} />
      <span className={`absolute left-0 h-0.5 w-5 rounded bg-current transition-all duration-300 ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
    </span>
  );
}
