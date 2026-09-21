"use client";

export function DatePicker({ date }: { date: string }) {
  return (
    <form>
      <input
        type="date"
        name="date"
        defaultValue={date}
        className="input"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
    </form>
  );
}
