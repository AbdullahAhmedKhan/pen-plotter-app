"use client";

import React, { useState, useEffect } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import opentype from "opentype.js";

const defaultFormatTemplates = {
  chumba: {
    label: "Chumba",
    requiredFields: ["name", "email", "code"],
    optionalFields: ["username", "date"],
    template: "Hello {name},\n{body}\nYour code is: {code}\nThank you!",
  },
  stake: {
    label: "Stake",
    requiredFields: ["name", "email", "username", "code"],
    optionalFields: ["date"],
    template: "Hi {username},\n{body}\nYour Stake code: {code}\nEnjoy!",
  },
};

const defaultProfile = {
  name: "",
  username: "",
  email: "",
  address: "",
  date: "",
  font: "Quicksand",
  cardSize: "4x6",
  type: "card",
  format: "chumba",
  body: "",
  code: "",
};

const PenPlotterApp = () => {
  const [profile, setProfile] = useState(defaultProfile);
  const [formatTemplates, setFormatTemplates] = useState(
    defaultFormatTemplates
  );
  const [template, setTemplate] = useState(
    defaultFormatTemplates[defaultProfile.format]
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFormat, setNewFormat] = useState({
    key: "",
    label: "",
    requiredFields: [],
    optionalFields: [],
    template: "",
  });
  const [savedProfiles, setSavedProfiles] = useState({});
  const [fontFile, setFontFile] = useState(null);
  const [fontOptions, setFontOptions] = useState(['Quicksand']);
  const [uploadedFontPath, setUploadedFontPath] = useState(null);
  const [fontFaceUrl, setFontFaceUrl] = useState(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const response = await fetch("/api/get-profiles");
        const data = await response.json();
        if (data.success) {
          setSavedProfiles(
            data.profiles.reduce(
              (acc, { key_name, profile_data }) => ({
                ...acc,
                [key_name]: JSON.parse(profile_data),
              }),
              {}
            )
          );
        }
      } catch (error) {
        console.error("Error fetching profiles:", error);
      }
    };

    const fetchFonts = async () => {
      try {
        const response = await fetch("/api/get-fonts");
        const data = await response.json();
        if (data.success) {
          const newFonts = data.fonts.map((font) =>
            font.name.replace(/\.ttf$/i, "")
          );
          setFontOptions((prev) => [...new Set([...prev, ...newFonts])]);
        }
      } catch (error) {
        console.error("Error fetching fonts:", error);
      }
    };

    fetchProfiles();
    fetchFonts();
  }, []);

  useEffect(() => {
    // Apply font face for preview
    const loadFontFace = async () => {
      if (fontFile && uploadedFontPath) {
        // For uploaded fonts, use object URL
        const fontUrl = URL.createObjectURL(fontFile);
        setFontFaceUrl(fontUrl);
        const style = document.createElement("style");
        style.textContent = `
          @font-face {
            font-family: "${profile.font}";
            src: url("${fontUrl}") format("truetype");
          }
        `;
        document.head.appendChild(style);
        return () => {
          document.head.removeChild(style);
          URL.revokeObjectURL(fontUrl);
        };
      } else {
        // For default fonts, assume they are in /public/fonts/
        const fontUrl = `/fonts/${profile.font}.ttf`;
        const style = document.createElement("style");
        style.textContent = `
          @font-face {
            font-family: "${profile.font}";
            src: url("${fontUrl}") format("truetype");
          }
        `;
        document.head.appendChild(style);
        setFontFaceUrl(fontUrl);
        return () => document.head.removeChild(style);
      }
    };

    loadFontFace();
  }, [profile.font, fontFile, uploadedFontPath]);

  const handleInput = (e) => {
    const { name, value } = e.target;
    setProfile({ ...profile, [name]: value });
    if (name === "font") {
      setUploadedFontPath(null);
      setFontFile(null);
      setFontFaceUrl(null);
    }
  };

  const handleFormatChange = (e) => {
    const newFormat = e.target.value;
    setProfile({ ...profile, format: newFormat });
    setTemplate(formatTemplates[newFormat]);
  };

  const generateRandomCode = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setProfile({ ...profile, code: randomCode });
  };

  useEffect(() => {
    // Generate initial random code on component mount
    generateRandomCode();
  }, []);

  const handleFontUpload = async () => {
    if (!fontFile) return;

    const formData = new FormData();
    formData.append("font", fontFile);

    try {
      const response = await fetch("/api/upload-font", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        alert("Font uploaded successfully!");
        const fontName = fontFile.name.replace(/\.ttf$/i, "");
        const fontPath = data.fontPath || `/fonts/${fontFile.name}`;
        setFontOptions((prev) => [...new Set([...prev, fontName])]);
        setProfile((prev) => ({ ...prev, font: fontName, fontPath: fontPath }));
        setUploadedFontPath(fontPath);
      } else {
        alert("Failed to upload font: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error uploading font:", error);
      alert("An error occurred while uploading the font.");
    }
  };

  const isRequired = (field) => template.requiredFields.includes(field);
  const isOptional = (field) => template.optionalFields.includes(field);

  const generatePreviewText = () => {
    return template.template
      .replace(/{name}/g, profile.name || "John Doe")
      .replace(/{username}/g, profile.username || "johndoe")
      .replace(/{email}/g, profile.email || "john@example.com")
      .replace(/{address}/g, profile.address || "123 Main St")
      .replace(
        /{date}/g,
        profile.date || new Date().toISOString().split("T")[0]
      )
      .replace(/{code}/g, profile.code || "123456")
      .replace(/{body}/g, profile.body || "This is a sample message.");
  };

  const generateGcode = async (text, profile) => {
    // Validate profile
    if (!profile || typeof profile !== "object") {
      throw new Error("Profile parameter is missing or invalid");
    }
    if (!profile.font && !profile.fontPath) {
      throw new Error('Profile must include either "font" or "fontPath"');
    }

    let gcode =
      ["G21", "G90", "F20000", "G1G90 Z0.5F20000", "G1G90 Z0.5F20000"].join(
        "\n"
      ) + "\n";

    const fontPath = profile.fontPath || `/fonts/${profile.font}.ttf`;
    const marginX = -2.351; // Match reference starting X
    const marginY = -3.679; // Match reference starting Y
    const fontSize = 4; // Adjusted for reference scale
    const lineHeight = fontSize + 0.3; // Tighter, reference-aligned spacing

    try {
      const font = await new Promise((resolve, reject) => {
        opentype.load(fontPath, (err, font) => {
          if (err) reject(err);
          else resolve(font);
        });
      });

      const scale = fontSize / font.unitsPerEm;
      const lines = text.split("\n").filter((line) => line.trim().length > 0);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        let x = marginX;
        let y = marginY + i * lineHeight;

        const lineGlyphs = font.stringToGlyphs(line);
        for (let j = 0; j < lineGlyphs.length; j++) {
          const glyph = lineGlyphs[j];
          const path = glyph.getPath(x, y, fontSize);
          let penDown = false;
          let prevX = x;
          let prevY = y;

          for (const cmd of path.commands) {
            if (cmd.type === "M") {
              if (penDown) {
                gcode += `G1G90 Z0.5F20000\n`; // Lift pen
                penDown = false;
              }
              if (cmd.x !== prevX || cmd.y !== prevY) {
                gcode += `G0 X${cmd.x.toFixed(3)}Y${cmd.y.toFixed(3)}F20000\n`;
                prevX = cmd.x;
                prevY = cmd.y;
              }
            } else if (cmd.type === "L") {
              if (!penDown) {
                gcode += `G1G90 Z-5.0F20000\n`; // Lower pen
                penDown = true;
              }
              if (cmd.x !== prevX || cmd.y !== prevY) {
                gcode += `G1 X${cmd.x.toFixed(3)}Y${cmd.y.toFixed(3)}F20000\n`;
                prevX = cmd.x;
                prevY = cmd.y;
              }
            } else if (cmd.type === "Q" || cmd.type === "C") {
              const steps = 2; // Minimized steps to reduce density
              let startX = prevX;
              let startY = prevY;
              for (let t = 0; t <= 1; t += 1 / steps) {
                const tx =
                  cmd.type === "Q"
                    ? (1 - t) * (1 - t) * startX +
                      2 * (1 - t) * t * cmd.x1 +
                      t * t * cmd.x
                    : Math.pow(1 - t, 3) * startX +
                      3 * Math.pow(1 - t, 2) * t * cmd.x1 +
                      3 * (1 - t) * t * t * cmd.x2 +
                      Math.pow(t, 3) * cmd.x;
                const ty =
                  cmd.type === "Q"
                    ? (1 - t) * (1 - t) * startY +
                      2 * (1 - t) * t * cmd.y1 +
                      t * t * cmd.y
                    : Math.pow(1 - t, 3) * startY +
                      3 * Math.pow(1 - t, 2) * t * cmd.y1 +
                      3 * (1 - t) * t * t * cmd.y2 +
                      Math.pow(t, 3) * cmd.y;
                if (!penDown) {
                  gcode += `G1G90 Z-5.0F20000\n`;
                  penDown = true;
                }
                if (tx !== prevX || ty !== prevY) {
                  gcode += `G1 X${tx.toFixed(3)}Y${ty.toFixed(3)}F20000\n`;
                  prevX = tx;
                  prevY = ty;
                }
              }
            }
          }

          if (penDown) {
            gcode += `G1G90 Z0.5F20000\n`;
          }
          x += glyph.advanceWidth * scale * 0.3; // Tighter glyph spacing
        }
      }

      gcode += ["G1G90 Z0.5F20000", "G90 G0 X0 Y0", "M30"].join("\n") + "\n";
      return gcode;
    } catch (error) {
      console.error("Error generating G-code:", error);
      throw new Error(`Failed to generate G-code: ${error.message}`);
    }
  };

  const handleRun = async () => {
    try {
      if (typeof window === "undefined") return;
      if (!profile.code) {
        alert("Please generate a code first.");
        return;
      }
      const missingFields = template.requiredFields
        .filter((field) => field !== "code" && !profile[field])
        .map((field) => field.charAt(0).toUpperCase() + field.slice(1));
      if (missingFields.length) {
        alert(`Please fill in required fields: ${missingFields.join(", ")}`);
        return;
      }
      if (!profile.font) {
        alert("Please select a font.");
        return;
      }

      const zip = new JSZip();
      const tmpl = template.template;

      let content = tmpl
        .replace(/{name}/g, profile.name || "")
        .replace(/{username}/g, profile.username || "")
        .replace(/{email}/g, profile.email || "")
        .replace(/{address}/g, profile.address || "")
        .replace(/{date}/g, profile.date || "")
        .replace(/{code}/g, profile.code)
        .replace(/{body}/g, profile.body || "");

      const gcode = await generateGcode(content, profile);
      const filename = `${profile.format}_001.gcode`;
      zip.file(filename, gcode);

      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${profile.format}_gcode.zip`);
    } catch (error) {
      console.error("Error generating G-code:", error);
      alert(`Failed to generate G-code: ${error.message}`);
    }
  };

  const handleClear = () => {
    setProfile({ ...defaultProfile, code: "" });
    generateRandomCode();
    setUploadedFontPath(null);
    setFontFile(null);
    setFontFaceUrl(null);
  };

  const handleSaveProfile = async () => {
    const key = prompt(
      "Enter a name to save this profile (e.g., ClientName - Format):"
    );
    if (!key) return;

    try {
      const response = await fetch("/api/save-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, profile }),
      });
      const data = await response.json();
      if (data.success) {
        alert("Profile saved!");
        setSavedProfiles((prev) => ({ ...prev, [key]: profile }));
      } else {
        alert("Failed to save profile.");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("An error occurred while saving the profile.");
    }
  };

  const handleLoadProfile = (key) => {
    const loadedProfile = savedProfiles[key];
    setProfile({ ...loadedProfile, code: profile.code });
    setTemplate(formatTemplates[loadedProfile.format]);
    setUploadedFontPath(null);
    setFontFile(null);
    setFontFaceUrl(null);
  };

  const handleAddFormat = () => {
    if (!newFormat.key || !newFormat.label || !newFormat.template) {
      alert(
        "Please fill in all required format fields (Key, Label, Template)."
      );
      return;
    }
    if (formatTemplates[newFormat.key]) {
      alert("Format key already exists. Please choose a unique key.");
      return;
    }
    setFormatTemplates({
      ...formatTemplates,
      [newFormat.key]: {
        label: newFormat.label,
        requiredFields: newFormat.requiredFields,
        optionalFields: newFormat.optionalFields,
        template: newFormat.template,
      },
    });
    setNewFormat({
      key: "",
      label: "",
      requiredFields: [],
      optionalFields: [],
      template: "",
    });
    setIsModalOpen(false);
  };

  const handleDeleteFormat = (key) => {
    if (key === "chumba" || key === "stake") {
      alert("Default formats (Chumba, Stake) cannot be deleted.");
      return;
    }
    if (
      window.confirm(
        `Are you sure you want to delete the ${formatTemplates[key].label} format?`
      )
    ) {
      const newFormats = { ...formatTemplates };
      delete newFormats[key];
      setFormatTemplates(newFormats);
      if (profile.format === key) {
        setProfile({ ...profile, format: "chumba" });
        setTemplate(formatTemplates["chumba"]);
      }
    }
  };

  const handleFieldToggle = (field, type) => {
    setNewFormat((prev) => {
      const newFields = { ...prev };
      const currentFields =
        type === "required" ? prev.requiredFields : prev.optionalFields;
      const otherFields =
        type === "required" ? prev.optionalFields : prev.requiredFields;
      if (currentFields.includes(field)) {
        newFields[type === "required" ? "requiredFields" : "optionalFields"] =
          currentFields.filter((f) => f !== field);
      } else {
        newFields[type === "required" ? "requiredFields" : "optionalFields"] = [
          ...currentFields,
          field,
        ];
        newFields[type === "required" ? "optionalFields" : "requiredFields"] =
          otherFields.filter((f) => f !== field);
      }
      return newFields;
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          Custom Pen Plotter Form
        </h2>

        <div className="flex justify-between mb-2 items-center bg-gray-50 p-4 rounded-lg shadow">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
          >
            Manage Formats
          </button>
          <div>
            <label className="block font-semibold text-gray-700">
              Upload Font (TTF)
            </label>
            <div className="flex gap-2">
              <input
                type="file"
                accept=".ttf"
                onChange={(e) => setFontFile(e.target.files[0])}
                className="w-full p-2 border rounded-lg file:mr-2 file:py-2 file:px-2 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              />
              <button
                onClick={handleFontUpload}
                className="bg-green-600 text-white px-2 py-2 rounded-lg hover:bg-green-700 transition"
                disabled={!fontFile}
              >
                Upload
              </button>
            </div>
          </div>
          <select
            onChange={(e) => handleLoadProfile(e.target.value)}
            className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Load Profile</option>
            {Object.keys(savedProfiles).map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-gray-700">Format</label>
            <select
              name="format"
              value={profile.format}
              onChange={handleFormatChange}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.keys(formatTemplates).map((key) => (
                <option key={key} value={key}>
                  {formatTemplates[key].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700">Font</label>
            <select
              name="font"
              value={profile.font}
              onChange={handleInput}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Select a font
              </option>
              {fontOptions.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700">
              Card Size
            </label>
            <select
              name="cardSize"
              value={profile.cardSize}
              onChange={handleInput}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="4x6">4x6</option>
              <option value="3x5">3x5</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700">Type</label>
            <select
              name="type"
              value={profile.type}
              onChange={handleInput}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="card">Card</option>
              <option value="envelope">Envelope</option>
            </select>
          </div>

          {(isRequired("name") || isOptional("name")) && (
            <div>
              <label className="block font-semibold text-gray-700">
                Name{" "}
                {isRequired("name") && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                name="name"
                value={profile.name}
                onChange={handleInput}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={isRequired("name")}
              />
            </div>
          )}

          {(isRequired("username") || isOptional("username")) && (
            <div>
              <label className="block font-semibold text-gray-700">
                Username{" "}
                {isRequired("username") && (
                  <span className="text-red-500">*</span>
                )}
              </label>
              <input
                type="text"
                name="username"
                value={profile.username}
                onChange={handleInput}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={isRequired("username")}
              />
            </div>
          )}

          {(isRequired("email") || isOptional("email")) && (
            <div>
              <label className="block font-semibold text-gray-700">
                Email{" "}
                {isRequired("email") && <span className="text-red-500">*</span>}
              </label>
              <input
                type="email"
                name="email"
                value={profile.email}
                onChange={handleInput}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={isRequired("email")}
              />
            </div>
          )}

          {(isRequired("address") || isOptional("address")) && (
            <div>
              <label className="block font-semibold text-gray-700">
                Address{" "}
                {isRequired("address") && (
                  <span className="text-red-500">*</span>
                )}
              </label>
              <input
                type="text"
                name="address"
                value={profile.address}
                onChange={handleInput}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={isRequired("address")}
              />
            </div>
          )}

          {(isRequired("date") || isOptional("date")) && (
            <div>
              <label className="block font-semibold text-gray-700">
                Date{" "}
                {isRequired("date") && <span className="text-red-500">*</span>}
              </label>
              <input
                type="date"
                name="date"
                value={profile.date}
                onChange={handleInput}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={isRequired("date")}
              />
            </div>
          )}
        </div>

        <div className="flex gap-4 mt-4">
          <div className="w-2/4">
            <label className="block font-semibold text-gray-700">Body</label>
            <textarea
              name="body"
              value={profile.body}
              onChange={handleInput}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              placeholder="Enter custom body text here..."
            />
          </div>

          <div className="w-2/4">
            <label className="block font-semibold text-gray-700">
              Generated Code
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={profile.code}
                readOnly
                className="w-full p-2 border rounded-lg bg-gray-100"
              />
              <button
                onClick={generateRandomCode}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Change
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="block font-semibold text-gray-700">Preview</label>
          <div
            className="w-full p-4 border rounded-lg bg-gray-50 whitespace-pre-wrap"
            style={{
              fontFamily: `"${profile.font}", sans-serif`,
              fontSize: "18px",
              lineHeight: "1.5",
              minHeight: "100px",
            }}
          >
            {fontFaceUrl ? generatePreviewText() : "Loading font..."}
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <button
            onClick={handleRun}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Run
          </button>
          <button
            onClick={handleClear}
            className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 transition"
          >
            Clear
          </button>
          <button
            onClick={handleSaveProfile}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            Save Profile
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full">
            <h3 className="text-xl font-bold mb-4 text-gray-800">
              Manage Formats
            </h3>
            <div className="mb-4">
              <label className="block font-semibold text-gray-700">
                Format Key
              </label>
              <input
                type="text"
                value={newFormat.key}
                onChange={(e) =>
                  setNewFormat({
                    ...newFormat,
                    key: e.target.value.toLowerCase(),
                  })
                }
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., global_poker"
              />
            </div>
            <div className="mb-4">
              <label className="block font-semibold text-gray-700">
                Format Label
              </label>
              <input
                type="text"
                value={newFormat.label}
                onChange={(e) =>
                  setNewFormat({ ...newFormat, label: e.target.value })
                }
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Global Poker"
              />
            </div>
            <div className="mb-4">
              <label className="block font-semibold text-gray-700">
                Template
              </label>
              <textarea
                value={newFormat.template}
                onChange={(e) =>
                  setNewFormat({ ...newFormat, template: e.target.value })
                }
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="4"
                placeholder="e.g., Hello {name},\n{body}\nYour code: {code}"
              />
            </div>
            <div className="mb-4">
              <label className="block font-semibold text-gray-700">
                Required Fields
              </label>
              {["name", "username", "email", "address", "date", "body"].map(
                (field) => (
                  <div key={field} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newFormat.requiredFields.includes(field)}
                      onChange={() => handleFieldToggle(field, "required")}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 capitalize text-gray-700">
                      {field}
                    </span>
                  </div>
                )
              )}
            </div>
            <div className="mb-4">
              <label className="block font-semibold text-gray-700">
                Optional Fields
              </label>
              {["name", "username", "email", "address", "date", "body"].map(
                (field) => (
                  <div key={field} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newFormat.optionalFields.includes(field)}
                      onChange={() => handleFieldToggle(field, "optional")}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 capitalize text-gray-700">
                      {field}
                    </span>
                  </div>
                )
              )}
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleAddFormat}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Add Format
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 transition"
              >
                Close
              </button>
            </div>
            <div className="mt-6">
              <h4 className="font-semibold text-gray-700">Existing Formats</h4>
              {Object.keys(formatTemplates).map((key) => (
                <div
                  key={key}
                  className="flex justify-between items-center mt-2"
                >
                  <span className="text-gray-700">
                    {formatTemplates[key].label}
                  </span>
                  <button
                    onClick={() => handleDeleteFormat(key)}
                    className="text-red-500 hover:text-red-700 transition"
                    disabled={key === "chumba" || key === "stake"}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PenPlotterApp;
