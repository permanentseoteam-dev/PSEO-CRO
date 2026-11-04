"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button, Card, CardHead, EmptyState, Field, FormGrid, Input, Select, StatCard, Stats, StatusDot, Table, Td, Th } from "@/components/ui";
import { requestRating, saveRating } from "../actions";
import { monthLabel, monthStart, ratingAverages, scoreTone } from "../logic";
import type { DeliveryRating } from "../types";
import { FormDialog, formValues, useRun } from "./shared";

type Props = {
  clientId: string;
  ratings: DeliveryRating[];
  departments: { id: string; name: string }[];
  canManage: boolean;
  emailConnected: boolean;
  today: string;
};

export function RatingsView({ clientId, ratings, departments, canManage, emailConnected, today }: Props) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useRun();
  const avg = ratingAverages(ratings, today);
  const lastMonth = monthStart(today, -1);
  const askMonth = ratings.some((r) => r.month === lastMonth) ? monthStart(today) : lastMonth;
  const show = (v: number | null) => (v == null ? "None" : v.toFixed(1));
  const months = [0, -1, -2, -3].map((d) => monthStart(today, d));
  const lowest = ratings.filter((r) => r.month >= monthStart(today, -3)).sort((a, b) => a.on_time - b.on_time)[0];

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Stats>
        <StatCard label="Quality, 3 months" value={show(avg.quality)} tone={scoreTone(avg.quality)} />
        <StatCard
          label="On time, 3 months"
          value={show(avg.on_time)}
          tone={scoreTone(avg.on_time)}
          sub={scoreTone(avg.on_time) && lowest ? `Lowest: ${lowest.department_name}, ${monthLabel(lowest.month)}` : undefined}
        />
        <StatCard label="Communication, 3 months" value={show(avg.communication)} tone={scoreTone(avg.communication)} />
      </Stats>

      <Card>
        <CardHead
          title="Monthly ratings from the client (1 to 5)"
          actions={
            canManage ? (
              <>
                {emailConnected ? (
                  <Button size="sm" disabled={pending} onClick={() => run(() => requestRating({ clientId, month: askMonth }), "Rating request sent")}>
                    Ask for {monthLabel(askMonth).split(" ")[0]} rating
                  </Button>
                ) : (
                  <StatusDot tone="muted">Email not connected</StatusDot>
                )}
                <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
                  Record rating
                </Button>
              </>
            ) : null
          }
        />
        {ratings.length === 0 ? (
          <EmptyState icon={<Star />} title="No ratings yet">
            Each month the client rates quality, on time and communication for every team.
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Month</Th>
                <Th>Team</Th>
                <Th right>Quality</Th>
                <Th right>On time</Th>
                <Th right>Communication</Th>
                <Th hideSm>Rated by</Th>
              </tr>
            </thead>
            <tbody>
              {ratings.map((r) => (
                <tr key={r.id}>
                  <Td>{monthLabel(r.month)}</Td>
                  <Td>{r.department_name}</Td>
                  <Td right num className={r.quality < 3 ? "t-danger" : undefined}>
                    {r.quality}
                  </Td>
                  <Td right num className={r.on_time < 3 ? "t-danger" : undefined}>
                    {r.on_time}
                  </Td>
                  <Td right num className={r.communication < 3 ? "t-danger" : undefined}>
                    {r.communication}
                  </Td>
                  <Td hideSm>{r.rated_by_name ?? ""}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <FormDialog
        id="cs-rating-add"
        title="Record a rating"
        submitLabel="Save rating"
        pending={pending}
        open={open}
        setOpen={setOpen}
        onSubmit={(e) => {
          const v = formValues(e);
          run(
            () =>
              saveRating({
                clientId,
                month: v.month,
                department_id: v.department_id,
                quality: Number(v.quality),
                on_time: Number(v.on_time),
                communication: Number(v.communication),
                rated_by_name: v.rated_by_name,
              }),
            "Rating saved",
            () => setOpen(false),
          );
        }}
      >
        <FormGrid>
          <Field label="Month" htmlFor="cs-rt-month">
            <Select id="cs-rt-month" name="month" defaultValue={lastMonth}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Team" htmlFor="cs-rt-dept">
            <Select id="cs-rt-dept" name="department_id" required>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          {(
            [
              ["quality", "Quality"],
              ["on_time", "On time"],
              ["communication", "Communication"],
            ] as const
          ).map(([name, label]) => (
            <Field key={name} label={label} htmlFor={`cs-rt-${name}`}>
              <Select id={`cs-rt-${name}`} name={name} defaultValue="4">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </Select>
            </Field>
          ))}
          <Field label="Rated by" htmlFor="cs-rt-by">
            <Input id="cs-rt-by" name="rated_by_name" maxLength={120} placeholder="Client contact name" />
          </Field>
        </FormGrid>
      </FormDialog>
    </div>
  );
}
