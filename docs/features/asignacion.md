# Asignación de features — Grupo 03

Reparto de las 12 features entre los 3 integrantes, respetando **dependencias** y priorizando el **MVP**.
Detalle de cada una en su `Fxx-*.md`. Orden global y dependencias en [`README.md`](./README.md).

| Feature | Owner | MVP | Depende de |
|---------|-------|:---:|------------|
| **F00** Setup | 👥 **Los 3 (kickoff juntos)** | 🧱 | — |
| **F01** Auth (registro/login) | **Valen** | ⭐ | F00 |
| **F02** Medios de pago | **Juan** | 🔓 | F01 |
| **F03** Subastas y catálogo | **Joaco** | 🔓 | F01 |
| **F04** Sesión en vivo + polling | **Juan** | 🔓 | F02, F03 |
| **F05** Pujar | **Juan** | ⭐ | F04 |
| **F06** Subir ítem (inclusión) | **Valen** | ⭐ | F01 |
| **F07** Ventas y pago | **Joaco** | ✅ | F05 |
| **F08** Métricas | **Valen** | ⭐ | F05 |
| **F09** Notificaciones | **Valen** | ⭐ | F01 |
| **F10** Multas | **Juan** | post | F07 |
| **F11** Seguros y cuentas de cobro | **Joaco** | post | F06 |

## Quién hace qué (resumen)

- **Juan (`juanimoli`)** — *la columna vertebral de la puja:* **F02 → F04 → F05 → F10**.
  Es el circuito más crítico y acoplado (medio de pago → conexión en vivo → puja con concurrencia → multa por impago).
- **Joaco (`JoaquinVillamediana`)** — *el lado subasta/venta/dueño:* **F03 → F07 → F11**.
  Catálogo y subastas, cierre de venta + pago de la compra, y seguros/cuentas de cobro.
- **Valen** — *onboarding + dueño + cierre informativo:* **F01 → F06 → F09 → F08**.
  Auth (lo primero, desbloquea a todos), subir ítem, notificaciones y métricas.

## Orden sugerido (para no pisarse)

```
Fase 0 (juntos):   F00  → ambos proyectos corriendo + smoke test (login con seed → JWT → /me)
Fase 1 (Valen):    F01  → desbloquea TODO el resto
Fase 2 (paralelo): Juan F02   ║  Joaco F03   ║  Valen F06  y  F09
Fase 3:            Juan F04 (necesita F02+F03) → F05      ║  Joaco F07 (necesita F05)
Fase 4:            Valen F08 (necesita F05)   ║  Juan F10 (necesita F07)  ║  Joaco F11 (necesita F06)
```

- Tras **F01**, los tres trabajan en paralelo: F02 (Juan), F03 (Joaco) y F06/F09 (Valen) solo dependen de F01.
- **F04** es el punto de convergencia: Juan necesita que estén F02 (suya) y F03 (de Joaco).
- Una rama por feature (`feat/Fxx-slug`), PR contra `main`, checklist de _Definition of Done_ (ver `README.md`).

> **MVP (entregable):** F01 · F05 · F06 · F08 · F09, con los habilitadores F02/F03/F04 y el cierre F07.
> Si hay que recortar, **F10 y F11 son post-MVP**.
