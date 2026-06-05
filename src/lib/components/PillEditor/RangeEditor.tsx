import type { ChangeEvent, KeyboardEvent } from "react";
import { EfInput } from "../ui/EfInput";
import { usePillEditorSelector } from "./PillEditorContext";
import { NumericInput } from "./NumericInput";
import styles from "./PillEditor.module.less";

export function RangeEditor(): JSX.Element {
	const field = usePillEditorSelector((s) => s.field);
	const local = usePillEditorSelector((s) => s.local);
	const setLocal = usePillEditorSelector((s) => s.setLocal);
	const localTo = usePillEditorSelector((s) => s.localTo);
	const setLocalTo = usePillEditorSelector((s) => s.setLocalTo);
	const inputType = usePillEditorSelector((s) => s.inputType);
	const saveRange = usePillEditorSelector((s) => s.saveRange);
	const isError = usePillEditorSelector((s) => s.isError);
	const onCancel = usePillEditorSelector((s) => s.onCancel);

	const isNumeric = field.type === "integer" || field.type === "float";
	const numStep = field.type === "float" ? "any" : 1;

	function handleFromKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
		if (e.key === "Enter") saveRange();
		if (e.key === "Escape") onCancel();
	}

	function handleToKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
		if (e.key === "Enter") saveRange();
		if (e.key === "Escape") onCancel();
	}

	const fromClass = `${styles.editor} ${styles.rangeFrom}${isError ? ` ${styles.editorError}` : ""}`;
	const toClass = `${styles.editor} ${styles.rangeTo}${isError ? ` ${styles.editorError}` : ""}`;

	if (isNumeric) {
		return (
			<>
				<NumericInput
					value={local}
					onChange={setLocal}
					step={numStep}
					className={fromClass}
					onKeyDown={handleFromKeyDown}
					placeholder="from"
					autoFocus
				/>
				<span className={styles.rangeSep}>to</span>
				<NumericInput
					value={localTo}
					onChange={setLocalTo}
					step={numStep}
					className={toClass}
					onKeyDown={handleToKeyDown}
					placeholder="to"
				/>
			</>
		);
	}

	return (
		<>
			<EfInput
				className={fromClass}
				type={inputType}
				value={local}
				onChange={(e: ChangeEvent<HTMLInputElement>) => setLocal(e.target.value)}
				onKeyDown={handleFromKeyDown}
				placeholder="from"
				autoFocus
			/>
			<span className={styles.rangeSep}>to</span>
			<EfInput
				className={toClass}
				type={inputType}
				value={localTo}
				onChange={(e: ChangeEvent<HTMLInputElement>) => setLocalTo(e.target.value)}
				onKeyDown={handleToKeyDown}
				placeholder="to"
			/>
		</>
	);
}
