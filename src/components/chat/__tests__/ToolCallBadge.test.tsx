import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToolCallBadge } from "../ToolCallBadge";

describe("ToolCallBadge", () => {
  describe("str_replace_editor labels", () => {
    it('shows "Creating App.jsx" for create command', () => {
      render(<ToolCallBadge toolName="str_replace_editor" args={{ command: "create", path: "/App.jsx" }} state="partial-call" />);
      expect(screen.getByText("Creating App.jsx")).toBeDefined();
    });

    it('shows "Editing Button.jsx" for str_replace command', () => {
      render(<ToolCallBadge toolName="str_replace_editor" args={{ command: "str_replace", path: "/components/Button.jsx" }} state="partial-call" />);
      expect(screen.getByText("Editing Button.jsx")).toBeDefined();
    });

    it('shows "Editing utils.js" for insert command', () => {
      render(<ToolCallBadge toolName="str_replace_editor" args={{ command: "insert", path: "/utils.js" }} state="partial-call" />);
      expect(screen.getByText("Editing utils.js")).toBeDefined();
    });

    it('shows "Reading index.js" for view command', () => {
      render(<ToolCallBadge toolName="str_replace_editor" args={{ command: "view", path: "/index.js" }} state="partial-call" />);
      expect(screen.getByText("Reading index.js")).toBeDefined();
    });

    it('shows "Reverting App.jsx" for undo_edit command', () => {
      render(<ToolCallBadge toolName="str_replace_editor" args={{ command: "undo_edit", path: "/App.jsx" }} state="partial-call" />);
      expect(screen.getByText("Reverting App.jsx")).toBeDefined();
    });
  });

  describe("file_manager labels", () => {
    it('shows "Renaming foo.jsx" for rename command', () => {
      render(<ToolCallBadge toolName="file_manager" args={{ command: "rename", path: "/foo.jsx" }} state="partial-call" />);
      expect(screen.getByText("Renaming foo.jsx")).toBeDefined();
    });

    it('shows "Deleting foo.jsx" for delete command', () => {
      render(<ToolCallBadge toolName="file_manager" args={{ command: "delete", path: "/foo.jsx" }} state="partial-call" />);
      expect(screen.getByText("Deleting foo.jsx")).toBeDefined();
    });
  });

  describe("fallback", () => {
    it("shows raw tool name for unknown tools", () => {
      render(<ToolCallBadge toolName="unknown_tool" args={{}} state="partial-call" />);
      expect(screen.getByText("unknown_tool")).toBeDefined();
    });
  });

  describe("state indicators", () => {
    it("renders spinner when state is not 'result'", () => {
      const { container } = render(
        <ToolCallBadge toolName="str_replace_editor" args={{ command: "create", path: "/App.jsx" }} state="partial-call" />
      );
      expect(container.querySelector(".animate-spin")).toBeTruthy();
    });

    it("renders green dot when state is 'result'", () => {
      const { container } = render(
        <ToolCallBadge toolName="str_replace_editor" args={{ command: "create", path: "/App.jsx" }} state="result" />
      );
      expect(container.querySelector(".bg-emerald-500")).toBeTruthy();
      expect(container.querySelector(".animate-spin")).toBeFalsy();
    });
  });
});
