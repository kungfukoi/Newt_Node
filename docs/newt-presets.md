# Newt Presets

Newt Presets save a selected section of the node graph as a reusable local template. A preset can include nodes, their settings and sizes, internal connections, complete groups, managed media dependencies, and optional inputs that can be rebound when the preset is inserted.

Newt Presets are separate from Style-node presets. The library groups bundled read-only definitions under **Built-in presets** and local user-created entries under **My presets**. Inserted copies of either kind remain editable.

## Create A Preset

1. Select one or more nodes with multi-select or a selection box.
2. Open **Presets** in the canvas menu bar and choose **Save selection as preset…**, or use **Preset** in the floating selection action bar.
3. Enter a unique preset name.
4. Optionally open **Reusable inputs**.
5. Select any saved input nodes that should be replaceable and assign an available role.
6. Select **Save**.

The preset captures only connections between selected nodes. A group is included only when every node in that group is selected. Connections to nodes outside the selection are deliberately omitted.

## Reusable Inputs

Reusable inputs let one saved graph structure work with assets already present in the destination project.

| Saved node type | Available roles |
| --- | --- |
| Image | Image, Location, Prop |
| Character | Character |
| Mood Board | Mood Board |
| Video | Video |
| Audio | Audio |

Roles describe the intended use; binding remains type-safe. For example, an Image slot can bind to another Image node, while a Character slot can bind only to a Character node.

## Insert A Preset

1. Open **Presets** in the canvas menu bar. The library remains available when the node palette is hidden.
2. Choose the preset.
3. For each reusable input, select a compatible node from the current project or leave **Preset default** selected.
4. Select **Insert preset**.

The inserted graph is placed beyond the occupied canvas and receives fresh node, edge, and group IDs. It is independent of both the saved preset and other inserted copies.

When a reusable input is bound, its saved input node is replaced by the chosen project node and outgoing connections are reattached. Matching `@tags` are updated and affected downstream generated results are cleared so stale media is not presented as belonging to the newly bound inputs. Insertion never runs or submits paid work automatically.

The toolbar control can be hidden or restored with **Settings > User Preferences > Show Presets Menu**. The existing saved preference is preserved. Hiding this control does not delete presets or disable creation from the selection action bar. Escape returns focus to the Presets button; clicking outside closes the library. Form controls retain their normal keyboard behavior.

## Delete A Preset

Choose a personal preset in the toolbar library and select **Delete**. Built-in presets cannot be deleted. Deleting the library entry does not remove copies already inserted into workflows. Copied dependency media is retained because those workflows may still reference it.

## Stored And Excluded Data

Presets preserve graph configuration and managed full-resolution media required by the selected nodes. Before storage, NewtNode removes credentials, passwords, secrets, authorization values, provider job IDs, active run state, and other transient execution fields.

Preset metadata is local runtime data under `server/data/newt-presets/`. Copied media is stored under `outputs/Newt-Presets/dependencies/`. Both are local to the NewtNode installation and are not published by a normal git commit.

Current limits:

- 1 to 80 characters per unique preset name.
- Up to 250 selected nodes.
- Up to 5 MB of serialized graph data before copied media.

## Troubleshooting

- **Preset button is missing:** select at least one node and look for the floating selection action bar above the selection.
- **A group was not saved:** select every node belonging to that group before creating the preset.
- **A binding choice is missing:** reusable slots show only current-project nodes with the matching stored node type.
- **Old results disappeared after binding:** this is intentional; dependent results are invalidated so they cannot be mistaken for output generated from the replacement input.
- **A deleted preset's media remains on disk:** dependency media is retained to protect workflows that already use it.
