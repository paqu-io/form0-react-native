import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

/** Run with the Native platform adapter; device layout and keyboard acceptance are separate. */
export function runNativeInputAndPaginationTests(FormRenderer, field) {
  afterEach(cleanup);
  for (const count of [15, 24])
    it(`Native validation displays fifteen findings per page; total=${count}`, async () => {
      render(
        <FormRenderer
          schema={{
            form: {
              name: "Findings",
              elements: Array.from({ length: count }, (_, index) =>
                field("NumericField", `answer_${index + 1}`, { min: 1 }),
              ),
            },
          }}
          initialValues={Object.fromEntries(
            Array.from({ length: count }, (_, index) => [
              `answer_${index + 1}`,
              0,
            ]),
          )}
          engineOptions={{ events: { lifecycle: false } }}
          onSubmit={vi.fn()}
        />,
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Submit", exact: true }),
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Findings", exact: true }),
      );
      if (count === 15) {
        expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
        return;
      }
      expect(await screen.findByText("1–15 of 24")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      expect(screen.getByText("16–24 of 24")).toBeTruthy();
      fireEvent.change(screen.getAllByDisplayValue("0")[0], {
        target: { value: "2" },
      });
      expect(await screen.findByText("16–23 of 23")).toBeTruthy();
      for (let index = 0; index < 8; index++)
        await act(async () =>
          fireEvent.change(screen.getAllByDisplayValue("0")[0], {
            target: { value: "2" },
          }),
        );
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Next" })).toBeNull(),
      );
    });

  it("Native required findings disappear one at a time after Submit", async () => {
    render(
      <FormRenderer
        schema={{
          form: {
            name: "Live findings",
            elements: ["first", "second", "third"].map((name) =>
              field("TextField", name, { required: true }),
            ),
          },
        }}
        engineOptions={{ events: { lifecycle: false } }}
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Submit", exact: true }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Live findings", exact: true }),
    );
    const findings = () => screen.queryAllByRole("button", {name: /^(first|second|third)This field is required/});
    expect(findings()).toHaveLength(3);
    for (const [index, name] of ["first", "second", "third"].entries()) {
      fireEvent.change(document.querySelector(`input[name="${name}"]`), {
        target: { value: "Fixed" },
      });
      await waitFor(() =>
        expect(findings()).toHaveLength(
          2 - index,
        ),
      );
    }
  });

  it("Native time retains every intermediate digit and clears normally", () => {
    const time = field("TimeField", "time");
    for (const name of [
      "supporting_image",
      "supporting_image_path",
      "supporting_image_display",
    ])
      delete time[name];
    render(
      <FormRenderer
        schema={{ form: { name: "Time", elements: [time] } }}
        engineOptions={{ events: { lifecycle: false } }}
      />,
    );
    const input = screen.getByPlaceholderText("HH:MM[:SS]");
    for (const value of [
      "1",
      "11",
      "11:",
      "11:3",
      "11:30",
      "11:30:4",
      "11:30:45",
      "",
    ]) {
      fireEvent.change(input, { target: { value } });
      expect(input.value).toBe(value);
    }
  });
  for (const type of ["SingleChoiceField", "MultiChoiceField"])
    it(`Native ${type} explains an unfinished Other answer`, async () => {
      render(
        <FormRenderer
          schema={{
            form: {
              name: "Choices",
              elements: [
                field(type, "habitat", {
                  choices: [{ value: "woodland", label: "Woodland" }],
                  allow_other: true,
                  is_searchable: false,
                  is_searchable_mode: "default",
                  display: type === "SingleChoiceField" ? "radio" : "checkbox",
                }),
              ],
            },
          }}
          engineOptions={{ events: { lifecycle: false } }}
        />,
      );
      fireEvent.click(screen.getByText("Other"));
      expect(
        await screen.findByText("Please specify an 'Other' value."),
      ).toBeTruthy();
      fireEvent.change(screen.getByPlaceholderText("Please specify..."), {
        target: { value: "Wetland" },
      });
      await waitFor(() =>
        expect(
          screen.queryByText("Please specify an 'Other' value."),
        ).toBeNull(),
      );
    });
}
