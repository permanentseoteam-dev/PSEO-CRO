"use client";

import { useState, useTransition } from "react";
import { Button, Dialog, Field, FormGrid, Input, Select, useToast } from "@/components/ui";
import { saveAdBudget } from "../actions";
import { CURRENCIES, type AdBudget, type Currency } from "../types";

export function BudgetEditor({ clientId, month, budget }: { clientId: string; month: string; budget: AdBudget | null }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(budget ? String(budget.amount) : "");
  const [currency, setCurrency] = useState<Currency>(budget?.currency ?? "AED");
  const [pending, start] = useTransition();
  const toast = useToast();

  const save = () =>
    start(async () => {
      const res = await saveAdBudget({ clientId, month, amount, currency });
      if (!res.ok) return toast(res.error);
      toast("Budget saved");
      setOpen(false);
    });

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {budget ? "Edit budget" : "Set budget"}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Monthly ad budget"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending || amount === ""} onClick={save}>
              Save budget
            </Button>
          </>
        }
      >
        <FormGrid>
          <Field label="Amount" htmlFor="bud-amount">
            <Input id="bud-amount" type="number" min={0} step="100" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Currency" htmlFor="bud-cur">
            <Select id="bud-cur" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </FormGrid>
      </Dialog>
    </>
  );
}
