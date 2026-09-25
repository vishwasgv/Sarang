# IPC layer

`handlers/<area>.handler.ts` are thin: validate (zod in `../validation`), `requirePermission`, call a service, return `ApiResponse`. Register new handlers in `index.ts`, type the channel in `channels.ts`, expose it in `../../preload/index.ts`. No business logic here.
