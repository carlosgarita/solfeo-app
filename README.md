# Solfeo · Práctica para principiantes

Aplicación web para practicar lectura de solfeo. Pensada para estudiantes principiantes de
instrumentos como piano, guitarra y bajo.

## Modos

1. **Práctica de notas**: el pentagrama muestra una clave y una sola nota. El estudiante la
   identifica y la toca en su instrumento.
2. **Práctica de tiempos**: se muestra un compás con figuras rítmicas básicas (redonda, blanca,
   negra y, opcionalmente, corcheas). El estudiante toca el ritmo sobre una nota cómoda.

## Configuración

- Clave: **Sol**, **Fa** o **Do** (en 3ª línea).
- Compás: **2/4**, **3/4**, **4/4** o **6/8** (usado en la práctica de tiempos).
- Modo piano: muestra **dos pentagramas** (gran pentagrama).
- Mostrar/ocultar el nombre de la nota.

## Atajos

- `Espacio`: generar el siguiente ejercicio.

## Stack

- [Vite](https://vitejs.dev/) + React + TypeScript
- [VexFlow](https://www.vexflow.com/) para renderizar partituras

## Desarrollo

```bash
npm install
npm run dev
```

Luego abre <http://localhost:5173>.

## Build

```bash
npm run build
npm run preview
```

## Próximamente (Fase 2)

- Selección de instrumento (bajo, guitarra, piano) con diagrama del lugar donde se toca cada nota.
- Revelado del diagrama tras unos segundos, antes de pasar a la siguiente nota.
- Modo de juego con puntaje y métricas.
