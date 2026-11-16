(function () {
	"use strict";

	var separator = ";";
	var state = { questions: [], parties: [] };
	var statusElement;
	var validationElement;

	function element(tag, className, text) {
		var node = document.createElement(tag);
		if (className) {
			node.className = className;
		}
		if (typeof text === "string") {
			node.textContent = text;
		}
		return node;
	}

	function setStatus(message, isError) {
		statusElement.textContent = message;
		statusElement.className = "alert " + (isError ? "alert-danger" : "alert-info");
	}

	function parseCsv(text) {
		return $.csv.toArrays(text, { separator: separator }).map(function (row) {
			return row.map(function (value) {
				return String(value || "").replace(/^\uFEFF/, "").trim();
			});
		});
	}

	function downloadCsv(filename, rows) {
		var csv = rows.map(function (row) {
			return row.map(function (value) {
				return "\"" + String(value == null ? "" : value).replace(/"/g, "\"\"") + "\"";
			}).join(separator);
		}).join("\r\n");
		var blob = new Blob(["\uFEFF", csv, "\r\n"], { type: "text/csv;charset=utf-8" });
		var url = URL.createObjectURL(blob);
		var link = element("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);
	}

	function makeField(labelText, value, onChange, type) {
		var wrapper = element("div", "form-group");
		var id = "field-" + Math.random().toString(36).slice(2);
		var label = element("label", "", labelText);
		label.htmlFor = id;
		var input = element(type === "textarea" ? "textarea" : "input", "form-control");
		input.id = id;
		if (type === "textarea") {
			input.rows = 2;
		} else {
			input.type = type || "text";
		}
		input.value = value == null ? "" : value;
		input.addEventListener("input", function () {
			onChange(input.value);
			validate();
		});
		wrapper.appendChild(label);
		wrapper.appendChild(input);
		return wrapper;
	}

	function makeRemoveButton(labelText, onClick) {
		var button = element("button", "btn btn-outline-danger btn-sm", labelText);
		button.type = "button";
		button.addEventListener("click", onClick);
		return button;
	}

	function render() {
		var questionsList = document.getElementById("questionsList");
		var partiesList = document.getElementById("partiesList");
		questionsList.replaceChildren();
		partiesList.replaceChildren();
		document.getElementById("questionCount").textContent = "(" + state.questions.length + ")";
		document.getElementById("partyCount").textContent = "(" + state.parties.length + ")";

		state.questions.forEach(function (question, index) {
			var card = element("article", "card editor-question");
			var body = element("div", "card-body");
			var header = element("div", "d-flex justify-content-between align-items-center mb-3");
			header.appendChild(element("h3", "h5 mb-0", "Frage " + (index + 1)));
			header.appendChild(makeRemoveButton("Frage entfernen", function () {
				state.questions.splice(index, 1);
				state.parties.forEach(function (party) {
					party.answers.splice(index, 1);
				});
				render();
			}));
			body.appendChild(header);
			body.appendChild(makeField("Kurzbezeichnung", question.short, function (value) {
				question.short = value;
			}));
			body.appendChild(makeField("Frage", question.long, function (value) {
				question.long = value;
			}, "textarea"));
			card.appendChild(body);
			questionsList.appendChild(card);
		});

		state.parties.forEach(function (party, partyIndex) {
			var card = element("article", "card editor-party");
			var body = element("div", "card-body");
			var header = element("div", "d-flex justify-content-between align-items-center mb-3");
			header.appendChild(element("h3", "h5 mb-0", "Endgerät " + (partyIndex + 1)));
			header.appendChild(makeRemoveButton("Endgerät entfernen", function () {
				state.parties.splice(partyIndex, 1);
				render();
			}));
			body.appendChild(header);
			body.appendChild(makeField("Kurzname", party.short, function (value) {
				party.short = value;
			}));
			body.appendChild(makeField("Name", party.long, function (value) {
				party.long = value;
			}));
			body.appendChild(makeField("Beschreibung (optional)", party.description, function (value) {
				party.description = value;
			}, "textarea"));
			body.appendChild(makeField("Webseite (optional)", party.url, function (value) {
				party.url = value;
			}));
			body.appendChild(makeField("Bilddatei (optional)", party.image, function (value) {
				party.image = value;
			}));

			party.answers.forEach(function (answer, answerIndex) {
				var answerBlock = element("div", "editor-answer");
				answerBlock.appendChild(element("h4", "h6", "Antwort zu „" + (state.questions[answerIndex] ? state.questions[answerIndex].short : "Frage " + (answerIndex + 1)) + "“"));
				answerBlock.appendChild(makeField("Punktewert (positiv = Zustimmung, negativ = Ablehnung)", answer.value, function (value) {
					answer.value = value;
				}, "number"));
				answerBlock.appendChild(makeField("Begründung / Antwort", answer.text, function (value) {
					answer.text = value;
				}, "textarea"));
				body.appendChild(answerBlock);
			});
			card.appendChild(body);
			partiesList.appendChild(card);
		});
		validate();
	}

	function validate() {
		var errors = [];
		if (state.questions.length === 0) {
			errors.push("Füge mindestens eine Frage hinzu.");
		}
		if (state.parties.length === 0) {
			errors.push("Füge mindestens ein Endgerät hinzu.");
		}
		state.questions.forEach(function (question, index) {
			if (!question.short || !question.long) {
				errors.push("Frage " + (index + 1) + " benötigt eine Kurzbezeichnung und einen Fragetext.");
			}
		});
		state.parties.forEach(function (party, partyIndex) {
			if (!party.short || !party.long) {
				errors.push("Endgerät " + (partyIndex + 1) + " benötigt einen Kurz- und einen Namen.");
			}
			if (party.answers.length !== state.questions.length) {
				errors.push("Endgerät " + (partyIndex + 1) + " hat " + party.answers.length + " Antworten; benötigt werden " + state.questions.length + ".");
			}
			party.answers.forEach(function (answer, answerIndex) {
				if (answer.value === "" || !isFinite(Number(answer.value))) {
					errors.push("Endgerät " + (partyIndex + 1) + ", Antwort " + (answerIndex + 1) + ": Bitte einen gültigen Punktewert eintragen.");
				}
			});
		});

		validationElement.replaceChildren();
		validationElement.hidden = errors.length === 0;
		if (errors.length) {
			validationElement.appendChild(element("strong", "", "Vor dem Export bitte korrigieren:"));
			var list = element("ul", "mb-0 mt-2");
			errors.forEach(function (message) {
				list.appendChild(element("li", "", message));
			});
			validationElement.appendChild(list);
		}
		return errors.length === 0;
	}

	function parseQuestions(text) {
		var rows = parseCsv(text).filter(function (row) {
			return row.some(function (value) { return value !== ""; });
		});
		return rows.map(function (row, index) {
			if (row.length < 2) {
				throw new Error("Frage " + (index + 1) + " hat keine zwei Spalten.");
			}
			return { short: row[0], long: row[1] };
		});
	}

	function parseParties(text, questionCount) {
		var rows = parseCsv(text);
		var starts = [];
		rows.forEach(function (row, index) {
			if (row[0] === "Partei_kurz:") {
				starts.push(index);
			}
		});
		if (!starts.length) {
			throw new Error("Keine Endgeräte gefunden (erwartet wird eine Zeile „Partei_kurz:“ je Endgerät).");
		}
		return starts.map(function (start, partyIndex) {
			var end = starts[partyIndex + 1] == null ? rows.length : starts[partyIndex + 1];
			var block = rows.slice(start, end).filter(function (row) {
				return row.some(function (value) { return value !== ""; });
			});
			if (block.length !== 5 + questionCount) {
				throw new Error("Endgerät " + (partyIndex + 1) + " hat " + Math.max(0, block.length - 5) + " Antworten; benötigt werden genau " + questionCount + ".");
			}
			function valueAt(rowIndex) {
				var row = block[rowIndex] || [];
				if (row.length < 2) {
					throw new Error("Ungültige CSV-Zeile bei Endgerät " + (partyIndex + 1) + ".");
				}
				return row[1];
			}
			var party = {
				short: valueAt(0),
				long: valueAt(1),
				description: valueAt(2),
				url: valueAt(3),
				image: valueAt(4),
				answers: []
			};
			for (var i = 0; i < questionCount; i++) {
				var answerRow = block[5 + i];
				if (!answerRow || answerRow.length < 2 || answerRow[0] === "" || !isFinite(Number(answerRow[0]))) {
					throw new Error("Ungültiger Punktewert bei Endgerät " + (partyIndex + 1) + ", Antwort " + (i + 1) + ".");
				}
				party.answers.push({ value: answerRow[0], text: answerRow[1] });
			}
			if (!party.short || !party.long) {
				throw new Error("Bei Endgerät " + (partyIndex + 1) + " fehlen Kurzname oder Name.");
			}
			return party;
		});
	}

	function makeQuestionsCsv() {
		return state.questions.map(function (question) {
			return [question.short, question.long];
		});
	}

	function makePartiesCsv() {
		var rows = [];
		state.parties.forEach(function (party, index) {
			if (index) {
				rows.push(["", ""]);
			}
			rows.push(
				["Partei_kurz:", party.short],
				["Partei_lang:", party.long],
				["Partei_Beschreibung:", party.description],
				["Partei_URL:", party.url],
				["Partei_Bild:", party.image]
			);
			party.answers.forEach(function (answer) {
				rows.push([answer.value, answer.text]);
			});
		});
		return rows;
	}

	function readFile(input, callback) {
		var file = input.files[0];
		if (!file) {
			return;
		}
		var reader = new FileReader();
		reader.onload = function () {
			try {
				callback(String(reader.result));
			} catch (error) {
				setStatus(error.message, true);
			}
			input.value = "";
		};
		reader.onerror = function () {
			setStatus("Die Datei konnte nicht gelesen werden.", true);
			input.value = "";
		};
		reader.readAsText(file, "UTF-8");
	}

	function loadProjectFiles() {
		Promise.all([
			fetch("data/Fragen.csv").then(function (response) {
				if (!response.ok) { throw new Error("Fragen.csv konnte nicht geladen werden."); }
				return response.text();
			}),
			fetch("data/Parteien.csv").then(function (response) {
				if (!response.ok) { throw new Error("Parteien.csv konnte nicht geladen werden."); }
				return response.text();
			})
		]).then(function (files) {
			var questions = parseQuestions(files[0]);
			var parties = parseParties(files[1], questions.length);
			state.questions = questions;
			state.parties = parties;
			render();
			setStatus("Projektdateien geladen. Änderungen werden erst beim Herunterladen exportiert.", false);
		}).catch(function (error) {
			setStatus(error.message + " Du kannst die CSV-Dateien oben manuell laden.", true);
		});
	}

	document.addEventListener("DOMContentLoaded", function () {
		statusElement = document.getElementById("editorStatus");
		validationElement = document.getElementById("editorValidation");

		document.getElementById("questionsFile").addEventListener("change", function (event) {
			readFile(event.target, function (text) {
				state.questions = parseQuestions(text);
				render();
				setStatus("Fragen geladen. Falls sich die Anzahl geändert hat, lade auch eine dazu passende Parteien.csv; abweichende Antwortzahlen werden nicht automatisch verändert.", false);
			});
		});
		document.getElementById("partiesFile").addEventListener("change", function (event) {
			readFile(event.target, function (text) {
				state.parties = parseParties(text, state.questions.length);
				render();
				setStatus("Endgeräte und Antworten geladen.", false);
			});
		});
		document.getElementById("addQuestion").addEventListener("click", function () {
			state.questions.push({ short: "", long: "" });
			state.parties.forEach(function (party) {
				party.answers.push({ value: "0", text: "" });
			});
			render();
		});
		document.getElementById("addParty").addEventListener("click", function () {
			state.parties.push({
				short: "",
				long: "",
				description: "",
				url: "",
				image: "",
				answers: state.questions.map(function () {
					return { value: "0", text: "" };
				})
			});
			render();
		});
		document.getElementById("downloadQuestions").addEventListener("click", function () {
			if (validate()) {
				downloadCsv("Fragen.csv", makeQuestionsCsv());
				setStatus("Fragen.csv wurde heruntergeladen.", false);
			}
		});
		document.getElementById("downloadParties").addEventListener("click", function () {
			if (validate()) {
				downloadCsv("Parteien.csv", makePartiesCsv());
				setStatus("Parteien.csv wurde heruntergeladen.", false);
			}
		});

		loadProjectFiles();
	});
}());
