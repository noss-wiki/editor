import { EditorState } from "noss-editor";
import { DOMView } from "../src";
import { doc, p, h1, text } from "./nodes";

const app = document.querySelector("#app");
const state = new EditorState(
  doc(
    h1("Noss editor"),
    p("The noss editor is cool", text("and fast!")),
    h1("Look another heading"),
    p("And another paragraph"),
  ),
);

const view = new DOMView(state);
app?.appendChild(view.root);
view.render();
