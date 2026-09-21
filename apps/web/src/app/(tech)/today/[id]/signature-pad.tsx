"use client";

import { useRef, useState } from "react";
import { submitSignatureAction } from "../../actions";

export function SignaturePad({ workOrderId }: { workOrderId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signerName, setSignerName] = useState("");

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = pos(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = pos(e);
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasDrawn(true);
    }
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  async function submit(formData: FormData) {
    const dataUrl = canvasRef.current?.toDataURL("image/png") ?? "";
    formData.set("imageUrl", dataUrl);
    await submitSignatureAction(formData);
    clear();
  }

  return (
    <form action={submit} className="space-y-2">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <canvas
        ref={canvasRef}
        width={320}
        height={140}
        className="border border-slate-300 rounded-md bg-white w-full touch-none"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex gap-2">
        <select name="signerRole" className="input" defaultValue="customer">
          <option value="customer">Customer</option>
          <option value="technician">Technician</option>
        </select>
        <input
          name="signerName"
          className="input"
          placeholder="Signer name"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={clear} className="btn-secondary text-sm">
          Clear
        </button>
        <button type="submit" disabled={!hasDrawn} className="btn-primary text-sm">
          Save signature
        </button>
      </div>
    </form>
  );
}
