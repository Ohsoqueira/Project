"use client";

import { useActionState } from "react";
import { updateCustomerAction } from "../actions";

type Customer = {
  id: string;
  name: string;
  category: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  billingCity: string | null;
  billingRegion: string | null;
};

export function CustomerEditForm({ customer }: { customer: Customer }) {
  const action = updateCustomerAction.bind(null, customer.id);
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Name</label>
          <input name="name" defaultValue={customer.name} required className="input" />
        </div>
        <div>
          <label className="label">Category</label>
          <input name="category" defaultValue={customer.category ?? ""} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" defaultValue={customer.email ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input name="phone" defaultValue={customer.phone ?? ""} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <input name="billingAddress" defaultValue={customer.billingAddress ?? ""} className="input" placeholder="Billing address" />
        <input name="billingCity" defaultValue={customer.billingCity ?? ""} className="input" placeholder="City" />
        <input name="billingRegion" defaultValue={customer.billingRegion ?? ""} className="input" placeholder="Province/State" />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button type="submit" className="btn-secondary text-sm">
        Save details
      </button>
    </form>
  );
}
