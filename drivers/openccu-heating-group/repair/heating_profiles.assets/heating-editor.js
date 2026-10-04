/* Shared Homey settings and repair view. No device writes occur before confirmation. */
(function (global) {
  "use strict";

  const DAYS = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ];
  const ERROR_CODES = new Set([
    "HEATING_UNAVAILABLE",
    "HEATING_UNSUPPORTED",
    "HEATING_INVALID",
    "HEATING_READ_ONLY",
    "HEATING_CONFLICT",
    "HEATING_BUSY",
    "HEATING_READ_FAILED",
    "HEATING_WRITE_FAILED",
  ]);

  function mount(root, options) {
    const doc = root.ownerDocument;
    const t = (key) => options.homey.__(`heating.${key}`);
    const state = {
      targets: [],
      target: options.target,
      schedule: undefined,
      profile: undefined,
      day: DAYS[0],
      draft: undefined,
      busy: false,
      blocked: false,
      confirmation: false,
      destroyed: false,
    };
    let confirmationResolver;
    let sequence = 0;
    const prefix = `heating-${++mount.counter}`;
    root.replaceChildren();
    root.classList.add("openccu-heating");
    const el = (tag, text, className) => {
      const element = doc.createElement(tag);
      if (text !== undefined) element.textContent = text;
      if (className) element.className = className;
      return element;
    };
    const key = (element, name) => {
      element.setAttribute("data-heating", name);
      return element;
    };
    const button = (label, name, handler) => {
      const element = key(el("button", t(label), "homey-button"), name);
      element.type = "button";
      element.addEventListener("click", handler);
      return element;
    };
    const field = (label, control, name) => {
      const wrapper = el("div", undefined, "homey-form-group");
      control.id = `${prefix}-${name}`;
      const caption = el("label", t(label), "homey-form-label");
      caption.htmlFor = control.id;
      wrapper.append(caption, control);
      return wrapper;
    };
    const option = (select, value, label) => {
      const item = el("option", label);
      item.value = String(value);
      select.append(item);
    };
    const select = (name) =>
      key(el("select", undefined, "homey-form-select"), name);
    const toolbar = el("fieldset", undefined, "heating-toolbar");
    const targetSelect = select("target");
    const targetField = field("target", targetSelect, "target");
    targetField.hidden = Boolean(options.target);
    const refresh = button("refresh", "refresh", () => void reload());
    toolbar.append(targetField, refresh);
    const heading = el("h2", t("title"), "homey-title");
    const intro = el("p", t("intro"), "homey-subtitle");
    const targetInfo = key(
      el("p", undefined, "heating-target-info"),
      "target-info",
    );
    targetInfo.hidden = !options.target;
    const groupInfo = el("p", t("group_hint"), "heating-hint");
    groupInfo.hidden = true;
    const status = key(el("p", undefined, "heating-status"), "status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const editor = el("fieldset", undefined, "heating-editor");
    editor.hidden = true;
    const profileSelect = select("profile");
    const profileHint = key(el("p", undefined, "heating-hint"), "profile-hint");
    const profileStatus = key(
      el("p", undefined, "heating-hint"),
      "profile-status",
    );
    const profilePicker = el("div", undefined, "heating-profile-picker");
    profilePicker.append(
      field("profile", profileSelect, "profile"),
      profileStatus,
    );
    const dayPicker = el("div", undefined, "heating-days");
    dayPicker.setAttribute("role", "group");
    dayPicker.setAttribute("aria-label", t("day"));
    const dayButtons = DAYS.map((day) => {
      const control = button(`days_short.${day}`, `day-${day}`, () => {
        if (locked() || state.blocked || !state.draft) return;
        state.day = day;
        renderRows();
      });
      control.setAttribute("aria-label", t(`days.${day}`));
      control.title = t(`days.${day}`);
      dayPicker.append(control);
      return control;
    });
    const dayHeading = key(
      el("h3", undefined, "heating-day-heading"),
      "day-heading",
    );
    const rowHeader = el("div", undefined, "heating-row-header");
    rowHeader.setAttribute("aria-hidden", "true");
    rowHeader.append(
      el("span"),
      el("span", t("end_time")),
      el("span", t("temperature")),
      el("span"),
    );
    const rows = key(el("div", undefined, "heating-rows"), "rows");
    const rowsHint = el("p", t("interval_hint"), "heating-hint");
    const scheduleInfo = key(
      el("details", undefined, "heating-info"),
      "schedule-info",
    );
    scheduleInfo.append(
      key(el("summary", t("schedule_info")), "info-toggle"),
      groupInfo,
      profileHint,
      rowsHint,
    );
    const add = button("add_interval", "add", addInterval);
    const copyDaySelect = select("copy-day-target");
    option(copyDaySelect, "ALL", t("other_days"));
    for (const day of DAYS) option(copyDaySelect, day, t(`days.${day}`));
    const copyDay = button("copy_day", "copy-day", () => {
      if (locked() || !state.draft) return;
      const days =
        copyDaySelect.value === "ALL"
          ? DAYS.filter((day) => day !== state.day)
          : [copyDaySelect.value];
      for (const day of days) state.draft[day] = clone(state.draft[state.day]);
      setStatus("draft_updated");
      updateActions();
    });
    const copyProfileSelect = select("copy-profile-source");
    const copyProfile = button("copy_profile", "copy-profile", async () => {
      if (locked() || !state.schedule) return;
      if (dirty() && !(await confirm(t("replace_draft"), "replace"))) return;
      const source = state.schedule.profiles.find(
        (profile) => profile.id === Number(copyProfileSelect.value),
      );
      if (!source) return;
      state.draft = editableDays(source.days);
      renderRows();
      setStatus("draft_updated");
    });
    const copyTools = key(
      el("details", undefined, "heating-copy-tools"),
      "copy-tools",
    );
    const copyDayRow = el("div", undefined, "heating-copy-row");
    copyDayRow.append(
      field("copy_day_to", copyDaySelect, "copy-day-target"),
      copyDay,
    );
    const copyProfileRow = el("div", undefined, "heating-copy-row");
    copyProfileRow.append(
      field("copy_profile_from", copyProfileSelect, "copy-profile-source"),
      copyProfile,
    );
    copyTools.append(
      key(el("summary", t("copy_tools")), "copy-tools-toggle"),
      copyDayRow,
      copyProfileRow,
    );
    const save = button("review_save", "save", () => void saveDraft());
    save.classList.add("homey-button-primary");
    const discard = button("discard", "discard", async () => {
      if (locked()) return;
      if (state.blocked) {
        await reload();
        return;
      }
      if (!dirty() || !(await confirm(t("discard_confirm"), "discard"))) return;
      resetDraft();
      renderRows();
      setStatus("ready");
    });
    const actions = el("div", undefined, "heating-actions");
    actions.append(save, discard);
    editor.append(
      profilePicker,
      scheduleInfo,
      dayPicker,
      dayHeading,
      rowHeader,
      rows,
      add,
      copyTools,
    );
    const confirmPanel = key(
      el("section", undefined, "heating-confirm"),
      "confirmation",
    );
    confirmPanel.hidden = true;
    confirmPanel.setAttribute("role", "region");
    confirmPanel.setAttribute("aria-label", t("confirm_title"));
    root.append(
      heading,
      intro,
      toolbar,
      targetInfo,
      status,
      editor,
      actions,
      confirmPanel,
    );

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }
    function clock(minutes) {
      return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    }
    function editableDays(days) {
      return Object.fromEntries(
        DAYS.map((day) => [
          day,
          days[day].map((slot) => ({
            end: clock(slot.end),
            temperature: String(slot.temperature),
          })),
        ]),
      );
    }
    function baseline() {
      return state.schedule?.profiles.find(
        (profile) => profile.id === state.profile,
      );
    }
    function dirty() {
      return Boolean(
        state.draft &&
        baseline() &&
        JSON.stringify(state.draft) !==
          JSON.stringify(editableDays(baseline().days)),
      );
    }
    function locked() {
      return state.busy || state.confirmation || state.destroyed;
    }
    function setStatus(message, detail = "") {
      status.textContent = `${t(message)}${detail ? ` ${detail}` : ""}`;
    }
    function errorCode(error) {
      const value =
        typeof error === "string" ? error : error?.code || error?.message;
      const match =
        typeof value === "string"
          ? value.match(/\bHEATING_[A-Z_]+\b/)?.[0]
          : undefined;
      return ERROR_CODES.has(match) ? match : "HEATING_UNAVAILABLE";
    }
    function showError(error) {
      setStatus(`errors.${errorCode(error)}`);
    }
    function updateActions() {
      toolbar.disabled = locked();
      editor.disabled = locked() || state.blocked || !state.schedule?.writable;
      save.disabled =
        locked() || state.blocked || !state.schedule?.writable || !dirty();
      discard.disabled = locked() || (!state.blocked && !dirty());
      actions.hidden = !state.schedule;
      add.disabled =
        !state.draft ||
        state.draft[state.day].length >= state.schedule.maxSlots;
      copyDay.disabled = copyDaySelect.value === state.day;
      copyProfile.disabled = copyProfileSelect.options.length === 0;
      const original = baseline() ? editableDays(baseline().days) : undefined;
      dayButtons.forEach((control, index) => {
        const day = DAYS[index];
        const changed = Boolean(
          state.draft &&
          original &&
          JSON.stringify(state.draft[day]) !== JSON.stringify(original[day]),
        );
        control.setAttribute("aria-pressed", String(day === state.day));
        control.setAttribute("data-changed", String(changed));
        control.setAttribute(
          "aria-label",
          `${t(`days.${day}`)}${changed ? ` · ${t("unsaved_day")}` : ""}`,
        );
      });
      root.setAttribute("aria-busy", String(state.busy));
    }
    function resetDraft() {
      state.draft = editableDays(baseline().days);
    }
    function acceptSchedule(schedule) {
      state.schedule = schedule;
      state.blocked = false;
      if (!schedule.profiles.some((profile) => profile.id === state.profile))
        state.profile = schedule.profiles[0]?.id;
      profileSelect.replaceChildren();
      for (const profile of schedule.profiles)
        option(profileSelect, profile.id, `${t("profile")} ${profile.id}`);
      profileSelect.value = String(state.profile);
      targetInfo.textContent = `${state.target.name} · ${state.target.model}`;
      groupInfo.hidden = !state.target.isGroup;
      editor.hidden = !schedule.profiles.length;
      if (!schedule.profiles.length) {
        state.schedule = undefined;
        state.draft = undefined;
        setStatus("empty");
        updateActions();
        return;
      }
      resetDraft();
      renderProfile();
      setStatus(schedule.writable ? "ready" : "read_only");
    }
    function renderProfile() {
      const schedule = state.schedule;
      rowsHint.textContent = `${t("interval_hint")} ${t("temperature_range")}: ${schedule.temperatureMin}–${schedule.temperatureMax} °C. ${t("max_intervals")}: ${schedule.maxSlots}.`;
      const selectable = schedule.selectableProfiles.join(", ") || t("none");
      const active =
        schedule.activeProfile === undefined
          ? t("unknown")
          : String(schedule.activeProfile);
      profileHint.textContent = `${t("fixed_slots")} ${t("selectable")}: ${selectable}. ${t("active")}: ${active}. ${t("no_activation")}`;
      profileStatus.textContent = `${t("active")}: ${active}`;
      copyProfileSelect.replaceChildren();
      for (const profile of schedule.profiles)
        if (profile.id !== state.profile)
          option(
            copyProfileSelect,
            profile.id,
            `${t("profile")} ${profile.id}`,
          );
      renderRows();
    }
    function renderRows() {
      rows.replaceChildren();
      dayHeading.textContent = t(`days.${state.day}`);
      const slots = state.draft[state.day];
      slots.forEach((slot, index) => {
        const row = el("div", undefined, "heating-slot");
        const rowTitle = el("span", `${index + 1}`, "heating-slot-number");
        rowTitle.setAttribute("aria-label", `${t("interval")} ${index + 1}`);
        const end = key(
          el("input", undefined, "homey-form-input"),
          `end-${index}`,
        );
        end.type = "text";
        end.inputMode = "numeric";
        end.placeholder = "HH:MM";
        end.maxLength = 5;
        end.value = slot.end;
        end.readOnly = index === slots.length - 1;
        end.setAttribute("aria-label", `${t("end_time")} ${index + 1}`);
        end.addEventListener("input", () => {
          slot.end = end.value;
          updateActions();
        });
        const temperature = key(
          el("input", undefined, "homey-form-input"),
          `temperature-${index}`,
        );
        temperature.type = "number";
        temperature.inputMode = "decimal";
        temperature.min = String(state.schedule.temperatureMin);
        temperature.max = String(state.schedule.temperatureMax);
        temperature.step = "any";
        temperature.value = slot.temperature;
        temperature.setAttribute(
          "aria-label",
          `${t("temperature")} ${index + 1}`,
        );
        temperature.addEventListener("input", () => {
          slot.temperature = temperature.value;
          updateActions();
        });
        const remove = button("remove_interval", `remove-${index}`, () => {
          if (locked() || slots.length <= 1) return;
          slots.splice(index, 1);
          slots[slots.length - 1].end = "24:00";
          renderRows();
        });
        remove.disabled = slots.length <= 1;
        remove.setAttribute(
          "aria-label",
          `${t("remove_interval")} ${index + 1}`,
        );
        remove.textContent = "×";
        remove.classList.add("heating-remove");
        remove.title = `${t("remove_interval")} ${index + 1}`;
        row.append(
          rowTitle,
          field("end_time", end, `end-${index}`),
          field("temperature", temperature, `temperature-${index}`),
          remove,
        );
        rows.append(row);
      });
      updateActions();
    }
    function addInterval() {
      if (locked() || state.blocked || !state.draft) return;
      const slots = state.draft[state.day];
      if (slots.length >= state.schedule.maxSlots) return;
      const start =
        slots.length === 1 ? 0 : minutes(slots[slots.length - 2].end);
      if (!Number.isFinite(start) || start >= 1439) {
        setStatus("errors.HEATING_INVALID");
        return;
      }
      const end = Math.min(
        1439,
        Math.max(start + 1, Math.round((start + 1440) / 2 / 5) * 5),
      );
      slots.splice(slots.length - 1, 0, {
        end: clock(end),
        temperature: slots[slots.length - 1].temperature,
      });
      renderRows();
    }
    function minutes(text) {
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text))
        return text === "24:00" ? 1440 : NaN;
      const [hour, minute] = text.split(":").map(Number);
      return hour * 60 + minute;
    }
    function requestDays() {
      return Object.fromEntries(
        DAYS.map((day) => {
          let previous = 0;
          const slots = state.draft[day];
          if (!slots.length || slots.length > state.schedule.maxSlots)
            throw "HEATING_INVALID";
          const result = slots.map((slot, index) => {
            const end = minutes(slot.end);
            const temperature = Number(slot.temperature);
            if (
              !Number.isFinite(end) ||
              end <= previous ||
              end < state.schedule.endTimeMin ||
              end > 1440 ||
              (index === slots.length - 1 && end !== 1440) ||
              (index < slots.length - 1 && end === 1440) ||
              !slot.temperature.trim() ||
              !Number.isFinite(temperature) ||
              temperature < state.schedule.temperatureMin ||
              temperature > state.schedule.temperatureMax
            )
              throw "HEATING_INVALID";
            previous = end;
            return { end, temperature };
          });
          return [day, result];
        }),
      );
    }
    function confirm(message, confirmLabel) {
      if (locked()) return Promise.resolve(false);
      state.confirmation = true;
      confirmPanel.replaceChildren();
      const description = el("p", message);
      const resolve = (answer) => {
        state.confirmation = false;
        confirmPanel.hidden = true;
        updateActions();
        const resolver = confirmationResolver;
        confirmationResolver = undefined;
        resolver?.(answer);
      };
      const yes = button(confirmLabel, "confirm-yes", () => resolve(true));
      const no = button("cancel", "confirm-no", () => resolve(false));
      confirmPanel.append(description, yes, no);
      confirmPanel.hidden = false;
      updateActions();
      no.focus();
      return new Promise((resolvePromise) => {
        confirmationResolver = resolvePromise;
      });
    }
    async function loadTarget(target) {
      if (locked()) return;
      state.busy = true;
      setStatus("loading");
      updateActions();
      const request = ++sequence;
      try {
        const schedule = await options.read(target.id);
        if (state.destroyed || request !== sequence) return;
        state.target = target;
        targetSelect.value = target.id;
        state.profile = undefined;
        acceptSchedule(schedule);
      } catch (error) {
        showError(error);
        targetSelect.value = state.target?.id || "";
      } finally {
        state.busy = false;
        updateActions();
      }
    }
    async function reload() {
      if (locked()) return;
      if (!state.target) {
        await initialise();
        return;
      }
      if (
        !state.blocked &&
        dirty() &&
        !(await confirm(t("discard_confirm"), "refresh"))
      )
        return;
      state.busy = true;
      updateActions();
      setStatus("loading");
      try {
        const schedule = await options.read(state.target.id);
        if (state.destroyed) return;
        if (state.blocked && dirty()) {
          const actual = schedule.profiles.find(
            (profile) => profile.id === state.profile,
          );
          if (
            actual &&
            JSON.stringify(editableDays(actual.days)) ===
              JSON.stringify(state.draft)
          ) {
            acceptSchedule(schedule);
            setStatus("confirmed");
            return;
          }
          state.busy = false;
          updateActions();
          if (!(await confirm(t("refresh_unconfirmed"), "replace"))) {
            setStatus("pending");
            return;
          }
        }
        acceptSchedule(schedule);
      } catch (error) {
        showError(error);
      } finally {
        state.busy = false;
        updateActions();
      }
    }
    async function saveDraft() {
      if (locked() || state.blocked || !dirty() || !state.schedule.writable)
        return;
      let days;
      try {
        days = requestDays();
      } catch (error) {
        showError(error);
        return;
      }
      const changed = DAYS.filter(
        (day) =>
          JSON.stringify(days[day]) !== JSON.stringify(baseline().days[day]),
      );
      const summary = `${t("save_confirm")} ${state.target.name} · ${t("profile")} ${state.profile}. ${t("changed_days")}: ${changed.map((day) => t(`days.${day}`)).join(", ")}.`;
      if (!(await confirm(summary, "confirm_save"))) return;
      state.busy = true;
      updateActions();
      setStatus("saving");
      try {
        const result = await options.save(state.target.id, {
          revision: state.schedule.revision,
          profile: state.profile,
          days,
        });
        if (state.destroyed) return;
        if (
          (result.status === "confirmed" || result.status === "unchanged") &&
          result.schedule
        ) {
          acceptSchedule(result.schedule);
          setStatus(result.status);
        } else {
          state.blocked = true;
          setStatus("pending");
        }
      } catch (error) {
        const code = errorCode(error);
        if (
          code === "HEATING_WRITE_FAILED" ||
          code === "HEATING_CONFLICT" ||
          code === "HEATING_UNAVAILABLE"
        )
          state.blocked = true;
        showError(error);
      } finally {
        state.busy = false;
        updateActions();
      }
    }
    async function initialise() {
      if (locked()) return;
      state.busy = true;
      setStatus("loading");
      updateActions();
      let target;
      try {
        state.targets = options.target
          ? [options.target]
          : await options.listTargets();
        if (state.destroyed) return;
        targetSelect.replaceChildren();
        for (const item of state.targets)
          option(targetSelect, item.id, `${item.name} · ${item.model}`);
        target = state.targets[0];
        if (!target) setStatus("empty");
      } catch (error) {
        showError(error);
      } finally {
        state.busy = false;
        updateActions();
      }
      if (target && !state.destroyed) await loadTarget(target);
    }
    targetSelect.addEventListener("change", async () => {
      const target = state.targets.find(
        (item) => item.id === targetSelect.value,
      );
      targetSelect.value = state.target?.id || "";
      if (!target || locked() || target.id === state.target?.id) return;
      if (
        (dirty() || state.blocked) &&
        !(await confirm(t("discard_confirm"), "discard"))
      )
        return;
      await loadTarget(target);
    });
    profileSelect.addEventListener("change", async () => {
      const profile = Number(profileSelect.value);
      profileSelect.value = String(state.profile);
      if (
        locked() ||
        state.blocked ||
        !state.schedule.profiles.some((item) => item.id === profile)
      )
        return;
      if (dirty() && !(await confirm(t("discard_confirm"), "discard"))) return;
      state.profile = profile;
      profileSelect.value = String(profile);
      resetDraft();
      renderProfile();
      setStatus("ready");
    });
    copyDaySelect.addEventListener("change", updateActions);
    const beforeUnload = (event) => {
      if (dirty() || state.blocked) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    global.addEventListener?.("beforeunload", beforeUnload);
    const ready = initialise();
    return {
      ready,
      reload,
      destroy() {
        state.destroyed = true;
        sequence += 1;
        confirmationResolver?.(false);
        global.removeEventListener?.("beforeunload", beforeUnload);
        root.replaceChildren();
      },
    };
  }
  mount.counter = 0;
  global.OpenCcuHeatingEditor = { mount };
})(window);
