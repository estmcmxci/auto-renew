/**
 * The proof pane. Static shell only (progress/demo.md D6): the log table
 * has its columns and zero rows. D10 (gated behind progress/contracts.md
 * C1, now met) fills it from real contract events and call results —
 * AGENTS.md hard rule 4 forbids writing a row here from frontend state, so
 * this component never will. Plain semantic HTML, not Thorin: ERD.md 8.1
 * asks for the ENS design system on the product pane specifically: this
 * pane is "the proof," not the product.
 */
export function RightPane() {
  return (
    <section aria-labelledby="right-pane-heading" className="pane pane-right">
      <h2 id="right-pane-heading">The session</h2>

      <dl className="field-list">
        <div className="field-row">
          <dt>Session key</dt>
          <dd>—</dd>
        </div>
        <div className="field-row">
          <dt>Session expiry</dt>
          <dd>—</dd>
        </div>
        <div className="field-row">
          <dt>Duration cap</dt>
          <dd>—</dd>
        </div>
        <div className="field-row">
          <dt>Spend cap</dt>
          <dd>—</dd>
        </div>
        <div className="field-row">
          <dt>Budget remaining</dt>
          <dd>—</dd>
        </div>
      </dl>

      <h3>Attempt log</h3>
      <table>
        <caption className="visually-hidden">
          Every renewal attempt, read from a contract event or a call result
        </caption>
        <thead>
          <tr>
            <th scope="col">Result</th>
            <th scope="col">Action</th>
            <th scope="col">Detail</th>
            <th scope="col">Reason</th>
          </tr>
        </thead>
        <tbody>{/* Empty until D10 wires real events. No placeholder row. */}</tbody>
      </table>
    </section>
  )
}
