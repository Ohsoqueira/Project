"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createCustomerAction } from "../actions";

export default function NewCustomerPage() {
  const [state, formAction] = useActionState(createCustomerAction, undefined);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">New customer</h1>
      <form action={formAction} className="card p-6 space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Customer name
          </label>
          <input id="name" name="name" required className="input" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="category">
              Category
            </label>
            <input id="category" name="category" className="input" placeholder="Commercial - Retail" />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Phone
            </label>
            <input id="phone" name="phone" className="input" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="email">
            Billing email
          </label>
          <input id="email" name="email" type="email" className="input" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <label className="label" htmlFor="billingAddress">
              Billing address
            </label>
            <input id="billingAddress" name="billingAddress" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="billingCity">
              City
            </label>
            <input id="billingCity" name="billingCity" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="billingRegion">
              Province/State
            </label>
            <input id="billingRegion" name="billingRegion" className="input" />
          </div>
        </div>
        {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">
            Create customer
          </button>
          <Link href="/customers" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
