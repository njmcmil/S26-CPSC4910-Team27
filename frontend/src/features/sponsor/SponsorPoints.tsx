import { useState } from 'react';
import { FormField } from '../../components/FormField';
import { Button } from '../../components/Button';

export function SponsorPointsPage() {
  const [driverSearch, setDriverSearch] = useState('');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');

  return (
    <section className="card" aria-labelledby="points-heading">
      <h2 id="points-heading">Manage Points</h2>
      <p className="mt-1">
        Add or deduct points for drivers with a reason for each adjustment.
      </p>

      <form
        className="mt-2"
        onSubmit={(e) => {
          e.preventDefault();
          // Placeholder: will wire to backend in a future sprint
        }}
        noValidate
      >
        <FormField
          label="Driver (search by name or ID)"
          id="points-driver"
          type="text"
          value={driverSearch}
          onChange={(e) => setDriverSearch(e.target.value)}
          helperText="Feature under development"
          disabled
        />

        <FormField
          label="Points (positive to add, negative to deduct)"
          id="points-amount"
          type="number"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          disabled
        />

        <FormField
          label="Reason"
          id="points-reason"
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          helperText="Required: explain why this adjustment is being made."
          disabled
        />

        <Button type="submit" disabled>
          Submit Adjustment
        </Button>
      </form>

      <p className="placeholder-msg mt-2">
        Point management is under development. Check back soon.
      </p>
    </section>
  );
}
