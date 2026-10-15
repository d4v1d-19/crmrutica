import { useMemo } from "react";
import { Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchSelect } from "@/components/clientes/SearchSelect";
import { paises } from "@/lib/clientes";
import { BILLING_FIELDS, optionItems, type FieldDef } from "@/lib/forms";
import cr from "@/data/costa-rica.json";

const division = cr as Record<string, Record<string, string[]>>;

function Err({ msg }: { msg?: string | undefined }) {
  return msg ? <p className="text-sm text-destructive">{msg}</p> : null;
}

export function FieldInput({
  field,
  value,
  onChange,
  errors,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  errors: Record<string, string>;
}) {
  const id = `f-${field.variable}`;
  const err = errors[field.variable];
  const label = (
    <Label htmlFor={id} className="text-sm font-medium">
      {field.etiqueta}
      {field.obligatorio && field.tipo !== "factura_electronica" && <span className="text-destructive"> *</span>}
    </Label>
  );
  const listaPaises = useMemo(() => (field.tipo === "dropdown_paises" ? paises() : []), [field.tipo]);
  const s = value === undefined || value === null ? "" : String(value);

  switch (field.tipo) {
    case "checkbox":
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Checkbox id={id} checked={value === true} onCheckedChange={(c) => onChange(c === true)} />
            {label}
          </div>
          <Err msg={err} />
        </div>
      );
    case "paragraph":
      return (
        <div className="space-y-2">
          {label}
          <Textarea id={id} rows={4} maxLength={5000} value={s} onChange={(e) => onChange(e.target.value)} />
          <Err msg={err} />
        </div>
      );
    case "number_stepper": {
      const n = Number.isFinite(Number(value)) ? Number(value) : 0;
      const min = field.opciones?.min ?? 0;
      const max = field.opciones?.max;
      return (
        <div className="space-y-2">
          {label}
          <div className="flex w-44 items-center gap-2">
            <Button type="button" variant="outline" size="icon" aria-label="Restar" onClick={() => onChange(Math.max(min, n - 1))}>
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              id={id}
              inputMode="numeric"
              className="text-center"
              value={s}
              onChange={(e) => {
                const t = e.target.value.replace(/[^0-9]/g, "");
                onChange(t === "" ? "" : parseInt(t, 10));
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Sumar"
              onClick={() => onChange(max !== undefined ? Math.min(max, n + 1) : n + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Err msg={err} />
        </div>
      );
    }
    case "si_no":
      return (
        <div className="space-y-2">
          {label}
          <RadioGroup value={s} onValueChange={onChange} className="flex gap-6">
            {optionItems(field).map((o) => (
              <div key={o.value} className="flex items-center gap-2">
                <RadioGroupItem id={`${id}-${o.value}`} value={o.value} />
                <Label htmlFor={`${id}-${o.value}`}>{o.label}</Label>
              </div>
            ))}
          </RadioGroup>
          <Err msg={err} />
        </div>
      );
    case "dropdown":
      return (
        <div className="space-y-2">
          {label}
          <Select value={s} onValueChange={onChange}>
            <SelectTrigger id={id}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {optionItems(field).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Err msg={err} />
        </div>
      );
    case "dropdown_paises":
      return (
        <div className="space-y-2">
          {label}
          <SearchSelect value={s} onChange={onChange} options={listaPaises} placeholder="Seleccionar país" />
          <Err msg={err} />
        </div>
      );
    case "factura_electronica": {
      const b = (value && typeof value === "object" ? value : {}) as Record<string, string>;
      const set = (k: string, v: string) => {
        const next = { ...b, [k]: v };
        if (k === "provincia") { next["canton"] = ""; next["distrito"] = ""; }
        if (k === "canton") next["distrito"] = "";
        onChange(next);
      };
      return (
        <fieldset className="space-y-4 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">{field.etiqueta}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {BILLING_FIELDS.map((bf) => {
              const e = errors[`${field.variable}.${bf.key}`];
              let control;
              if (bf.key === "provincia")
                control = <SearchSelect value={b["provincia"]} options={Object.keys(division)} onChange={(v) => set("provincia", v)} />;
              else if (bf.key === "canton")
                control = (
                  <SearchSelect
                    value={b["canton"]}
                    disabled={!b["provincia"]}
                    options={b["provincia"] ? Object.keys(division[b["provincia"]] ?? {}) : []}
                    onChange={(v) => set("canton", v)}
                  />
                );
              else if (bf.key === "distrito")
                control = (
                  <SearchSelect
                    value={b["distrito"]}
                    disabled={!b["canton"]}
                    options={b["provincia"] && b["canton"] ? division[b["provincia"]]?.[b["canton"]] ?? [] : []}
                    onChange={(v) => set("distrito", v)}
                  />
                );
              else
                control = (
                  <Input
                    type={bf.key === "email" ? "email" : "text"}
                    maxLength={300}
                    value={b[bf.key] ?? ""}
                    onChange={(ev) => set(bf.key, ev.target.value)}
                  />
                );
              return (
                <div key={bf.key} className={`space-y-2 ${bf.key === "direccion_fiscal" ? "sm:col-span-2" : ""}`}>
                  <Label className="text-sm font-medium">{bf.label} <span className="text-destructive">*</span></Label>
                  {control}
                  <Err msg={e} />
                </div>
              );
            })}
          </div>
        </fieldset>
      );
    }
    default:
      return (
        <div className="space-y-2">
          {label}
          <Input
            id={id}
            maxLength={500}
            type={field.tipo === "email" ? "email" : field.tipo === "telefono" ? "tel" : field.tipo === "number" ? "number" : "text"}
            value={s}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.opciones?.ayuda && !err && <p className="text-xs text-muted-foreground">{field.opciones.ayuda}</p>}
          <Err msg={err} />
        </div>
      );
  }
}
