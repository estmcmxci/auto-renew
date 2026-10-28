import { Card, Checkbox, Heading, Tag, Typography } from '@ensdomains/thorin'

/**
 * The product pane. Static shell only (progress/demo.md D6): every value
 * here is a placeholder. D10 (gated behind progress/contracts.md C1, now
 * met) wires this to the operator's real reads. Nothing in this component
 * may synthesize a status or a value — AGENTS.md hard rule 4 — so a field
 * with nothing to show yet reads "—", not a guess.
 */
export function LeftPane() {
  return (
    <section aria-labelledby="left-pane-heading" className="pane pane-left">
      <Card>
        <Heading as="h2" id="left-pane-heading" level="2">
          The name
        </Heading>

        <dl className="field-list">
          <div className="field-row">
            <dt>
              <Typography as="span" weight="bold">
                Name
              </Typography>
            </dt>
            <dd>
              <Typography as="span">—</Typography>
            </dd>
          </div>

          <div className="field-row">
            <dt>
              <Typography as="span" weight="bold">
                Expiry
              </Typography>
            </dt>
            <dd>
              <Typography as="span">—</Typography>
            </dd>
          </div>

          <div className="field-row">
            <dt>
              <Typography as="span" weight="bold">
                Countdown
              </Typography>
            </dt>
            <dd>
              <Typography as="span">—</Typography>
            </dd>
          </div>

          <div className="field-row">
            <dt />
            <dd>
              <Checkbox
                id="auto-renew-toggle"
                className="thorin-checkbox-visible-fix"
                label="Auto-renew"
                checked={false}
                readOnly
              />
            </dd>
          </div>

          <div className="field-row">
            <dt>
              <Typography as="span" weight="bold">
                Funding source
              </Typography>
            </dt>
            <dd>
              <Typography as="span">—</Typography>
            </dd>
          </div>

          <div className="field-row">
            <dt>
              <Typography as="span" weight="bold">
                Balance
              </Typography>
            </dt>
            <dd>
              <Typography as="span">—</Typography>
            </dd>
          </div>

          <div className="field-row">
            <dt>
              <Typography as="span" weight="bold">
                Fallback address
              </Typography>
            </dt>
            <dd>
              <Typography as="span">—</Typography>
            </dd>
          </div>
        </dl>

        <Tag colorStyle="greySecondary">Not configured</Tag>
      </Card>
    </section>
  )
}
