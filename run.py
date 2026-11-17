"""Pruebas de extremo a extremo sobre dev/demo.html (datos ficticios en memoria).

Uso:  python3 tests/e2e/run.py [carpeta_de_capturas]
Requiere: pip install playwright  (usa el Chrome instalado en el sistema).
"""
import functools, http.server, pathlib, socketserver, sys, threading
from playwright.sync_api import sync_playwright, expect

RAIZ = pathlib.Path(__file__).resolve().parents[2]
CAPTURAS = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None


class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def servidor():
    manejador = functools.partial(Silencioso, directory=str(RAIZ))
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), manejador)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def captura(page, nombre):
    if CAPTURAS:
        CAPTURAS.mkdir(parents=True, exist_ok=True)
        page.wait_for_timeout(450)  # deja terminar la animación de entrada
        page.screenshot(path=str(CAPTURAS / f"{nombre}.png"), full_page=True)


def ingresar(page, base, email, clave="demo1234"):
    page.goto(f"{base}/dev/demo.html")
    page.fill("[name=email]", email)
    page.fill("[name=clave]", clave)
    page.click("button[type=submit]")


def main():
    srv = servidor()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    problemas = []
    with sync_playwright() as pw:
        nav = pw.chromium.launch(channel="chrome")

        def nueva_pagina(**kw):
            ctx = nav.new_context(**kw)
            # Recursos externos (fuentes, logos) no existen en el entorno de pruebas.
            ctx.route(lambda u: not u.startswith(base) and not u.startswith("about:"), lambda r: r.abort())
            page = ctx.new_page()
            page.on("pageerror", lambda e: problemas.append(f"error JS: {e}"))
            page.on("console", lambda m: problemas.append(f"consola: {m.text}")
                    if m.type == "error" and "ERR_FAILED" not in m.text and "Failed to load resource" not in m.text else None)
            return ctx, page

        # 1 · Ingreso: credenciales malas, validación y cuenta pendiente
        ctx, page = nueva_pagina(viewport={"width": 1366, "height": 860})
        page.goto(f"{base}/dev/demo.html")
        expect(page.locator(".lcard")).to_be_visible()
        captura(page, "01-ingreso")
        page.fill("[name=email]", "no-es-correo")
        page.click("button[type=submit]")
        expect(page.locator(".lerr")).to_contain_text("correo válido")
        ingresar(page, base, "admin@demo.co", "incorrecta")
        expect(page.locator(".lerr")).to_contain_text("Correo o contraseña incorrectos")
        assert "admin@demo.co" in page.input_value("[name=email]")
        ingresar(page, base, "nueva@demo.co")
        expect(page.locator(".lwait")).to_contain_text("pendiente de activación")
        captura(page, "02-pendiente")
        page.click("[data-action=salir]")
        expect(page.locator("[name=email]")).to_be_visible()

        # 2 · Administrador: inicio
        ingresar(page, base, "admin@demo.co")
        expect(page.locator(".hero h1")).to_contain_text("Ana")
        expect(page.locator(".kpi").first).to_contain_text("3")  # en progreso
        assert page.locator(".nv").count() == 8
        captura(page, "03-inicio")

        # 3 · XSS almacenado: el dato hostil se muestra como texto y no se ejecuta
        page.click(".nv[data-mod=auditorias]")
        expect(page.locator(".item")).to_have_count(5)
        expect(page.locator(".list")).to_contain_text('<img src=x onerror="window.__xss=1">')
        assert page.evaluate("window.__xss") is None
        assert page.locator(".list img[src=x]").count() == 0
        captura(page, "04-auditorias")

        # 4 · Filtros y papelera
        page.click("[data-filtro=completada]")
        expect(page.locator(".item")).to_have_count(2)
        page.click("[data-filtro=todas]")
        fila = page.locator(".item", has_text="Sede Sur")
        fila.locator("[data-action=papelera]").click()
        expect(page.locator(".toast").last).to_contain_text("papelera")
        expect(page.locator(".item")).to_have_count(4)
        page.click("[data-filtro=papelera]")
        expect(page.locator(".item")).to_have_count(2)
        captura(page, "05-papelera")
        page.locator(".item", has_text="Sede Sur").locator("[data-action=restaurar]").click()
        expect(page.locator(".item")).to_have_count(1)
        page.locator("[data-action=borrar]").click()
        expect(page.locator("dialog[open]")).to_contain_text("no se puede deshacer")
        captura(page, "06-confirmar")
        page.keyboard.press("Escape")
        expect(page.locator(".item")).to_have_count(1)  # Escape cancela
        page.locator("[data-action=borrar]").click()
        page.click("dialog[open] [data-cerrar=si]")
        expect(page.locator(".empty")).to_contain_text("Papelera vacía")

        # 5 · Crear auditoría: abre la lista en otra pestaña con el id nuevo
        page.click("[data-filtro=todas]")
        page.click("[data-action=nueva]")
        expect(page.locator("dialog[open]")).to_contain_text("Nueva auditoría de servicio")
        captura(page, "07-nueva")
        page.locator(".opt", has_text="VIU").click()
        with ctx.expect_page() as otra:
            page.click("dialog[open] button[type=submit]")
        otra.value.wait_for_url("**/Lista_Verificacion_VIU.html?auditId=AUD-*")
        assert "uid=u-admin" in otra.value.url
        otra.value.close()
        expect(page.locator(".item")).to_have_count(6)
        expect(page.locator(".item").first).to_contain_text("Sin sede — VIU")

        # 6 · Paciente incógnito: incluye el registro que llegó por QR
        page.click(".seg a[href='#/auditorias/pi']")
        expect(page.locator(".item")).to_have_count(2)
        expect(page.locator(".list")).to_contain_text("Paciente (QR)")
        enlace = page.locator(".item", has_text="Sede Norte").locator("a.btn").get_attribute("href")
        assert "Lista_Paciente_Incognito_FOCA" in enlace and "auditId=PI-DEMO-0001" in enlace

        # 7 · Usuarios: activar la cuenta pendiente; no puede degradarse a sí mismo
        page.click(".nv[data-mod=usuarios]")
        expect(page.locator(".card").first).to_contain_text("nueva@demo.co")
        captura(page, "08-usuarios")
        assert page.locator("#rol-u-admin").is_disabled()
        page.select_option("#rol-u-nueva", "gestor")
        page.click("[data-action=aprobar]")
        expect(page.locator(".toast").last).to_contain_text("Cuenta activada")
        expect(page.locator(".card").first).to_contain_text("Sin solicitudes")
        assert page.locator("#rol-u-nueva").input_value() == "gestor"

        # 7b · Dashboard: KPIs, tendencia, filtros, hallazgos con detalle escapado
        page.click(".nv[data-mod=dashboard]")
        expect(page.locator(".kpis .kpi")).to_have_count(4)
        expect(page.locator("svg.ln")).to_be_visible()
        total = int(page.locator(".kpi .kv").first.inner_text())
        assert total == 13, f"auditorías calificadas: {total}"
        captura(page, "12-dashboard")
        page.click(".fbar [data-action=inst][data-id=viu]")
        expect(page.locator(".kpi .kv").first).to_have_text("4")
        page.select_option("[data-filtro=sede]", "Sede Centro")
        expect(page.locator(".kpi .kv").first).to_have_text("3")
        page.click(".fbar [data-action=limpiar]")
        expect(page.locator(".kpi .kv").first).to_have_text("13")
        page.locator(".bars .btnr", has_text="Sede Sur").click()
        expect(page.locator("[data-filtro=sede]")).to_have_value("Sede Sur")
        page.click(".fbar [data-action=limpiar]")
        assert page.locator(".hz").count() > 0
        page.click("[data-action=tipo][data-id=CP]")
        expect(page.locator("[data-action=tipo][data-id=CP]")).to_have_attribute("aria-pressed", "true")
        page.click("[data-action=tipo][data-id=NC]")
        page.locator(".hz", has=page.locator(".badge")).first.click()
        expect(page.locator("dialog[open] .obs li").first).to_be_visible()
        captura(page, "13-hallazgo")
        page.keyboard.press("Escape")
        expect(page.locator("dialog[open]")).to_have_count(0)
        assert page.evaluate("window.__xss") is None

        # 7c · Equipo: una tarjeta por auditor, con filtro por institución
        page.click(".nv[data-mod=equipo]")
        expect(page.locator(".mbr")).to_have_count(3)
        expect(page.locator(".team")).to_contain_text("Gina Gestión")
        captura(page, "14-equipo")
        carlos = page.locator(".mbr", has_text="Carlos Prueba")
        expect(carlos.locator(".mbr-k dd").first).to_have_text("5")
        page.click(".fbar [data-action=inst][data-id=viu]")
        expect(carlos.locator(".row.mini")).to_have_count(2)

        # 8 · Módulo clásico, ruta inexistente y cierre de sesión
        page.click(".nv[data-mod=indicadores]")
        expect(page.locator(".puente")).to_contain_text("versión clásica")
        assert page.locator(".puente a").get_attribute("rel") == "noopener"
        page.goto(f"{base}/dev/demo.html#/no-existe")
        expect(page.locator(".nv[aria-current=page]")).to_have_attribute("data-mod", "inicio")
        page.click("[data-action=salir]")
        page.click("dialog[open] [data-cerrar=si]")
        expect(page.locator("[name=email]")).to_be_visible()
        ctx.close()

        # 9 · Lector: sin crear ni borrar, y sin acceso a Usuarios aunque escriba la ruta
        ctx, page = nueva_pagina(viewport={"width": 1366, "height": 860})
        ingresar(page, base, "lector@demo.co")
        expect(page.locator(".hero h1")).to_contain_text("Lucía")
        assert page.locator(".nv[data-mod=usuarios]").count() == 0
        assert page.locator(".nv[data-mod=equipo]").count() == 0
        assert page.locator(".hero .btn.pri").count() == 0
        page.goto(f"{base}/dev/demo.html#/equipo")
        expect(page.locator(".nv[aria-current=page]")).to_have_attribute("data-mod", "inicio")
        page.click(".nv[data-mod=dashboard]")
        expect(page.locator(".kpis .kpi")).to_have_count(4)
        page.goto(f"{base}/dev/demo.html#/usuarios")
        expect(page.locator(".nv[aria-current=page]")).to_have_attribute("data-mod", "inicio")
        page.goto(f"{base}/dev/demo.html#/auditorias/servicio/nueva")
        expect(page.locator(".bar h2")).to_be_visible()
        assert page.locator("[data-action=nueva]").count() == 0
        assert page.locator("dialog[open]").count() == 0
        ctx.close()

        # 10 · Auditor: solo ve las suyas; móvil con menú lateral
        ctx, page = nueva_pagina(viewport={"width": 390, "height": 844})
        ingresar(page, base, "auditor@demo.co")
        expect(page.locator(".hero h1")).to_contain_text("Carlos")
        captura(page, "09-movil-inicio")
        expect(page.locator(".side")).not_to_be_in_viewport()
        page.click(".mbar [data-action=menu]")
        expect(page.locator(".side")).to_be_in_viewport()
        captura(page, "10-movil-menu")
        page.click(".nv[data-mod=auditorias]")
        expect(page.locator(".side")).not_to_be_in_viewport()
        expect(page.locator(".item")).to_have_count(5)
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "desborde horizontal en móvil"
        captura(page, "11-movil-auditorias")
        page.goto(f"{base}/dev/demo.html#/dashboard")
        expect(page.locator("svg.ln")).to_be_visible()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "desborde horizontal en el dashboard móvil"
        captura(page, "15-movil-dashboard")
        ctx.close()
        nav.close()
    srv.shutdown()

    if problemas:
        print("\n".join(problemas))
        sys.exit(1)
    print("E2E: 13 escenarios correctos, sin errores de consola ni violaciones de CSP")


if __name__ == "__main__":
    main()
