import json
from pathlib import Path
from typing import Dict, List, Any

LESSONS_DIR = Path(__file__).parent.parent.parent.parent / "qualution-frontend" / "src" / "features" / "theory" / "lessons"

def load_sidecar_metadata(filepath: Path) -> Dict[str, Any]:
    """
    Attempts to load a matching sidecar metadata file (.meta.json) for a lesson.
    Sidecars can live in a 'sidecars/' subdirectory or adjacent to the lesson JSON.
    """
    stem = filepath.stem
    candidates = [
        filepath.parent / "sidecars" / f"{stem}.meta.json",
        filepath.parent / f"{stem}.meta.json"
    ]
    for cand in candidates:
        if cand.exists():
            try:
                with open(cand, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
    return {}

def scan_lesson_concepts(lessons_dir: Path = LESSONS_DIR) -> Dict[str, Any]:
    """
    Scans all JSON lesson files in the lessons directory (excluding sidecars)
    and validates whether each step, action, or stage has concept mappings
    either inline or via sidecar metadata files.
    """
    unmapped_steps: List[Dict[str, Any]] = []
    summary_per_lesson: Dict[str, Any] = {}
    total_lessons = 0

    json_files = [f for f in lessons_dir.rglob("*.json") if not f.name.endswith(".meta.json")]

    for filepath in json_files:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue

        lesson_id = data.get("id") or data.get("lesson_id") or filepath.stem
        sidecar = load_sidecar_metadata(filepath)
        sidecar_steps = sidecar.get("steps", {})

        total_lessons += 1
        lesson_concepts = data.get("concepts", [])
        lesson_unmapped = []

        # Check declarative lesson actions
        if "actions" in data and isinstance(data["actions"], list):
            for i, act in enumerate(data["actions"]):
                act_type = act.get("type", "")
                if act_type in ["CHECKPOINT", "WORKBENCH", "ASSESSMENT"]:
                    item_id = act.get("id", f"action_{i}")
                    sidecar_meta = sidecar_steps.get(item_id, {})
                    has_concept = bool(
                        act.get("concepts") or
                        act.get("concept") or
                        sidecar_meta.get("concepts") or
                        lesson_concepts
                    )
                    if not has_concept:
                        lesson_unmapped.append({
                            "type": "action",
                            "index": i,
                            "action_type": act_type,
                            "id": item_id
                        })
                        unmapped_steps.append({
                            "lesson_file": filepath.name,
                            "lesson_id": lesson_id,
                            "step_id": item_id,
                            "reason": f"Interactive action '{act_type}' has no concepts defined at action, sidecar, or lesson level"
                        })

        # Check steps in lessonSchema format
        if "steps" in data and isinstance(data["steps"], list):
            for i, step in enumerate(data["steps"]):
                step_id = step.get("id", f"step_{i}")
                sidecar_meta = sidecar_steps.get(step_id, {})
                has_concept = bool(
                    step.get("concepts") or
                    sidecar_meta.get("concepts") or
                    lesson_concepts
                )
                if not has_concept:
                    lesson_unmapped.append({"type": "step", "index": i, "id": step_id})
                    unmapped_steps.append({
                        "lesson_file": filepath.name,
                        "lesson_id": lesson_id,
                        "step_id": step_id,
                        "reason": "Step has no concepts defined at step, sidecar, or lesson level"
                    })

        # Check stages format (e.g. lesson-8-grovers-search)
        if "stages" in data and isinstance(data["stages"], list):
            for i, stage in enumerate(data["stages"]):
                stage_id = stage.get("stage_id", f"stage_{i}")
                has_concept = bool(stage.get("concepts") or lesson_concepts)
                # Check actions within stage
                stage_actions = stage.get("actions", [])
                for act in stage_actions:
                    if isinstance(act, dict) and act.get("type") == "CHECKPOINT":
                        item_id = act.get("id", stage_id)
                        sidecar_meta = sidecar_steps.get(item_id, {})
                        has_ckpt_concept = bool(
                            act.get("concepts") or
                            sidecar_meta.get("concepts") or
                            has_concept
                        )
                        if not has_ckpt_concept:
                            lesson_unmapped.append({"type": "stage_checkpoint", "stage": stage_id, "id": item_id})
                            unmapped_steps.append({
                                "lesson_file": filepath.name,
                                "lesson_id": lesson_id,
                                "step_id": item_id,
                                "reason": f"Checkpoint in stage '{stage_id}' has no concepts defined"
                            })

        summary_per_lesson[lesson_id] = {
            "file": filepath.name,
            "has_top_level_concepts": bool(lesson_concepts),
            "unmapped_interactive_count": len(lesson_unmapped)
        }

    return {
        "total_lessons": total_lessons,
        "unmapped_steps": unmapped_steps,
        "summary_per_lesson": summary_per_lesson
    }
