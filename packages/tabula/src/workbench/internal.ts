/**
 * Internal application surface used by the Tabula.md app itself.
 *
 * This stays outside the documented package API because its props include
 * Tabula application concerns such as collaboration bindings and comments.
 * The public package API is TabulaEmbeddedDocumentWorkbench.
 */
export {
  TabulaDocumentSurface,
  type TabulaDocumentSurfaceProps,
} from "./TabulaDocumentSurface";
