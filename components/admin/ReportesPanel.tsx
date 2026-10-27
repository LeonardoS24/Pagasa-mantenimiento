"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { enviarReporteAhora, guardarReportes } from "@/actions/reportes-actions";
import type { ActionState } from "@/actions/user-actions";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export type ConfigReportesVista = {
  activo: boolean;
  destinatarios: string;
  diaSemana: number;
  hora: number;
  diasAnticipacion: number;
  smtpHost: string;
  smtpPuerto: number;
  smtpSeguro: boolean;
  smtpUsuario: string;
  remitente: string;
  tieneClave: boolean;
  claveIlegible: boolean;
  urlBase: string;
  servidorDelEnv: boolean;
  ultimoEnvio: string | null;
  ultimoError: string | null;
  ultimoResumen: string | null;
  proximoEnvio: string | null;
  avisoRojoActivo: boolean;
  avisoRojoUltimoResumen: string | null;
};

function Boton({ texto, enCurso, className }: { texto: string; enCurso: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? enCurso : texto}
    </button>
  );
}

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" });
}

function EnviarAhora() {
  const [state, formAction] = useFormState(enviarReporteAhora, initialState);
  return (
    <form action={formAction} className="space-y-2">
      <Boton
        texto="Enviar el reporte ahora"
        enCurso="Enviando..."
        className="rounded-lg border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/5"
      />
      <p className="text-xs text-gray-500">Se manda con lo último que guardaste. Sirve para probar que llega.</p>
      <FormMessage state={state} />
    </form>
  );
}

export function ReportesPanel({ config }: { config: ConfigReportesVista }) {
  const [state, formAction] = useFormState(guardarReportes, initialState);
  const [host, setHost] = useState(config.smtpHost);
  const [puerto, setPuerto] = useState(String(config.smtpPuerto));
  const [seguro, setSeguro] = useState(config.smtpSeguro);

  const usar = (h: string, p: number, s: boolean) => {
    setHost(h);
    setPuerto(String(p));
    setSeguro(s);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-ink">
        Cada semana el sistema manda por correo los <strong>vencidos</strong> y lo que vence en los próximos días,
        agrupado por ciudad, a las personas que pongas aquí. El servidor del sistema necesita salida a internet para
        usar un correo como Gmail u Outlook.
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm">
        <h2 className="mb-2 font-semibold text-primary">Estado</h2>
        <ul className="space-y-1 text-ink">
          <li>
            Envío automático:{" "}
            <strong className={config.activo ? "text-green-700" : "text-gray-500"}>{config.activo ? "activado" : "desactivado"}</strong>
          </li>
          {config.proximoEnvio && <li>Próximo envío: {fechaHora(config.proximoEnvio)}</li>}
          <li>Último envío automático: {config.ultimoEnvio ? fechaHora(config.ultimoEnvio) : "todavía ninguno"}</li>
          {config.ultimoResumen && <li className="text-gray-600">{config.ultimoResumen}</li>}
          {config.ultimoError && (
            <li className="rounded-md bg-red-50 px-3 py-2 text-red-700">Último error: {config.ultimoError}</li>
          )}
        </ul>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <EnviarAhora />
        </div>
      </div>

      <form action={formAction} className="space-y-6">
        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-primary">A quién y cuándo</h2>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="activo" defaultChecked={config.activo} className="h-4 w-4" />
            Enviar el reporte automáticamente cada semana
          </label>
          <div>
            <label htmlFor="destinatarios" className="mb-1 block text-sm font-medium text-ink">
              Correos que lo reciben
            </label>
            <textarea
              id="destinatarios"
              name="destinatarios"
              rows={4}
              defaultValue={config.destinatarios}
              placeholder={"normatividad@empresa.com\nmantenimiento@empresa.com"}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-500">Uno por línea (o separados por coma). Máximo 30.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="diaSemana" className="mb-1 block text-sm font-medium text-ink">Día</label>
              <select id="diaSemana" name="diaSemana" defaultValue={config.diaSemana} className={inputClass}>
                {DIAS.map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="hora" className="mb-1 block text-sm font-medium text-ink">Hora</label>
              <select id="hora" name="hora" defaultValue={config.hora} className={inputClass}>
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="diasAnticipacion" className="mb-1 block text-sm font-medium text-ink">Incluir lo que vence en (días)</label>
              <input id="diasAnticipacion" name="diasAnticipacion" type="number" min={1} max={365} defaultValue={config.diasAnticipacion} className={inputClass} />
            </div>
          </div>
          <p className="text-xs text-gray-500">La hora es la del servidor. Los vencidos siempre se incluyen.</p>
          <div className="rounded-md border border-red-200 bg-red-50/50 p-3">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="avisoRojoActivo" defaultChecked={config.avisoRojoActivo} className="h-4 w-4" />
              Además, avisar cada día cuando algo pase a rojo (7 días o menos, o vencido)
            </label>
            <p className="mt-1 text-xs text-gray-600">
              Un correo al día, a la misma hora, a los mismos destinatarios y solo con lo nuevo en rojo desde el aviso anterior.
              Si no hay nada nuevo, no se manda nada.
            </p>
            {config.avisoRojoUltimoResumen && <p className="mt-1 text-xs text-gray-500">Último: {config.avisoRojoUltimoResumen}</p>}
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-primary">Cuenta de correo que envía</h2>
          {config.servidorDelEnv && !config.smtpHost && (
            <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
              El servidor ya tiene una cuenta configurada en su archivo .env; se usará esa mientras no captures una aquí.
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" onClick={() => usar("smtp.gmail.com", 465, true)} className="rounded border border-gray-300 px-2 py-1 text-primary hover:bg-primary/5">
              Usar datos de Gmail
            </button>
            <button type="button" onClick={() => usar("smtp.office365.com", 587, false)} className="rounded border border-gray-300 px-2 py-1 text-primary hover:bg-primary/5">
              Usar datos de Outlook / Microsoft 365
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="smtpHost" className="mb-1 block text-sm font-medium text-ink">Servidor (SMTP)</label>
              <input id="smtpHost" name="smtpHost" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.gmail.com" className={inputClass} />
            </div>
            <div>
              <label htmlFor="smtpPuerto" className="mb-1 block text-sm font-medium text-ink">Puerto</label>
              <input id="smtpPuerto" name="smtpPuerto" type="number" value={puerto} onChange={(e) => setPuerto(e.target.value)} className={inputClass} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="smtpSeguro" checked={seguro} onChange={(e) => setSeguro(e.target.checked)} className="h-4 w-4" />
            Conexión cifrada directa (puerto 465). Si usas el puerto 587, déjala sin marcar.
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="smtpUsuario" className="mb-1 block text-sm font-medium text-ink">Usuario (el correo)</label>
              <input id="smtpUsuario" name="smtpUsuario" type="text" autoComplete="off" defaultValue={config.smtpUsuario} placeholder="reportes@gmail.com" className={inputClass} />
            </div>
            <div>
              <label htmlFor="smtpClave" className="mb-1 block text-sm font-medium text-ink">Contraseña</label>
              <input
                id="smtpClave"
                name="smtpClave"
                type="password"
                autoComplete="new-password"
                placeholder={config.tieneClave ? "•••••••• (guardada; déjala vacía para conservarla)" : ""}
                className={inputClass}
              />
              {config.claveIlegible && (
                <p className="mt-1 text-xs text-red-600">La contraseña guardada ya no se puede abrir. Escríbela de nuevo.</p>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="remitente" className="mb-1 block text-sm font-medium text-ink">Nombre del remitente (opcional)</label>
            <input id="remitente" name="remitente" defaultValue={config.remitente} placeholder="Mantenimiento Pagasa <reportes@gmail.com>" className={inputClass} />
          </div>
          <details className="rounded-md bg-gray-50 p-3 text-xs text-gray-600">
            <summary className="cursor-pointer font-medium text-ink">¿Cómo uso una cuenta de Gmail?</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>En la cuenta de Google activa la verificación en 2 pasos.</li>
              <li>Entra a myaccount.google.com/apppasswords y crea una contraseña de aplicación (16 letras).</li>
              <li>Aquí pon el correo como usuario y esa contraseña de 16 letras (no la normal de la cuenta).</li>
              <li>Con Gmail el servidor es smtp.gmail.com, puerto 465 y la conexión cifrada marcada.</li>
            </ol>
            <p className="mt-2">La contraseña se guarda cifrada en la base y nunca se vuelve a mostrar.</p>
          </details>
        </section>

        <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-primary">Dirección del sistema</h2>
          <div>
            <input id="urlBase" name="urlBase" defaultValue={config.urlBase} placeholder="http://192.168.1.50:3000" className={inputClass} />
            <p className="mt-1 text-xs text-gray-500">
              Con la que se abre el sistema desde las computadoras y celulares de la empresa. Se usa para que cada
              unidad del correo sea un enlace (y para los códigos QR). Si la dejas vacía, el correo va sin enlaces.
            </p>
          </div>
        </section>

        <div className="space-y-3">
          <FormMessage state={state} />
          <Boton texto="Guardar" enCurso="Guardando..." className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-primary-dark" />
        </div>
      </form>
    </div>
  );
}
