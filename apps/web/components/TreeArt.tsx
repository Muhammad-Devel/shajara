/** Decorative animated family tree (parents' marriage dashed, parent→child solid). */
export function TreeArt() {
  return (
    <svg className="tree-art" viewBox="0 0 400 330" role="img" aria-label="Avlodlar daraxti tasviri">
      {/* generation 1 couple */}
      <path className="line-marriage fade" style={{ animationDelay: "0.2s" }} d="M130 40 H270" />
      {/* generation 1 → 2 */}
      <path className="line-parent draw" pathLength={1} style={{ animationDelay: "0.4s" }} d="M200 40 V90 M100 90 H300 M100 90 V120 M300 90 V120" />
      {/* generation 2 couple */}
      <path className="line-marriage fade" style={{ animationDelay: "0.9s" }} d="M100 150 H60 M300 150 H340" />
      {/* generation 2 → 3 */}
      <path className="line-parent draw" pathLength={1} style={{ animationDelay: "1s" }} d="M300 180 V230 M240 230 H360 M240 230 V260 M360 230 V260" />

      {[
        [130, 40], [270, 40], [100, 150], [300, 150], [60, 150], [340, 150], [240, 290], [360, 290],
      ].map(([cx, cy], i) => (
        <circle key={i} className="node fade" style={{ animationDelay: `${0.1 + i * 0.12}s` }} cx={cx} cy={cy} r={22} />
      ))}
      <text className="node-text fade" style={{ animationDelay: "1.3s" }} x="200" y="322">Avlodlar</text>
    </svg>
  );
}
