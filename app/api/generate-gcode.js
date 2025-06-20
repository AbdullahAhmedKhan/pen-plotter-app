import opentype from 'opentype.js';
import { SVGPathData } from 'svg-pathdata';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, profile } = req.body;

    // Validate input
    if (!text || !profile || !profile.font) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const fontPath = profile.fontPath || `/fonts/${profile.font}.ttf`;

    // Load font using opentype.js
    let font;
    try {
      font = await new Promise((resolve, reject) => {
        opentype.load(fontPath, (err, loadedFont) => {
          if (err) reject(new Error(`Failed to load font: ${err.message}`));
          else resolve(loadedFont);
        });
      });
    } catch (error) {
      return res.status(500).json({ error: `Font loading error: ${error.message}` });
    }

    // Initialize G-code
    let gcode = [
      'G21', // Metric units
      'G90', // Absolute positioning
      'F20000', // Feed rate
      'G1G90 Z1.0F20000', // Safe height
      'G1G90 Z1.0F20000',
    ].join('\n') + '\n';

    // Font and layout settings
    const marginX = 1.665;
    const marginY = 7.136;
    const fontSize = 8;
    const lineHeight = fontSize * 1.2;
    const letterSpacing = 0.1;
    const scale = fontSize / font.unitsPerEm;

    // Process each line of text
    const lines = text.split('\n').filter((line) => line.trim().length > 0);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let baseX = marginX;
      let baseY = marginY + i * lineHeight;

      // Process each character
      for (const char of line) {
        const glyph = font.charToGlyph(char);
        if (!glyph) continue;

        // Get glyph path
        const path = glyph.getPath(0, 0, fontSize);
        const pathData = path.toPathData();
        if (!pathData) continue;

        // Parse SVG path
        const svgPath = new SVGPathData(pathData);
        let penDown = false;
        let firstMove = true;
        let prevX = baseX;
        let prevY = baseY;

        // Process path commands
        for (const cmd of svgPath.commands) {
          let x, y;
          if (cmd.type === SVGPathData.MOVE_TO) {
            x = baseX + cmd.x * scale;
            y = baseY - cmd.y * scale;
            if (penDown) {
              gcode += `G1G90 Z1.0F20000\n`;
              penDown = false;
            }
            if (firstMove && (x !== prevX || y !== prevY)) {
              gcode += `G0 X${x.toFixed(3)}Y${y.toFixed(3)}F20000\n`;
              firstMove = false;
            }
            prevX = x;
            prevY = y;
          } else if (cmd.type === SVGPathData.LINE_TO) {
            x = baseX + cmd.x * scale;
            y = baseY - cmd.y * scale;
            if (!penDown) {
              gcode += `G1G90 Z-6.0F20000\n`;
              penDown = true;
            }
            if (x !== prevX || y !== prevY) {
              gcode += `G1 X${x.toFixed(3)}Y${y.toFixed(3)}F20000\n`;
              prevX = x;
              prevY = y;
            }
          } else if (cmd.type === SVGPathData.QUAD_TO || cmd.type === SVGPathData.CUBIC_TO) {
            if (!penDown) {
              gcode += `G1G90 Z-6.0F20000\n`;
              penDown = true;
            }
            const steps = 20;
            for (let t = 0; t <= 1; t += 1 / steps) {
              let tx, ty;
              if (cmd.type === SVGPathData.QUAD_TO) {
                tx =
                  (1 - t) * (1 - t) * prevX +
                  2 * (1 - t) * t * (baseX + cmd.x1 * scale) +
                  t * t * (baseX + cmd.x * scale);
                ty =
                  (1 - t) * (1 - t) * prevY +
                  2 * (1 - t) * t * (baseY - cmd.y1 * scale) +
                  t * t * (baseY - cmd.y * scale);
              } else {
                tx =
                  Math.pow(1 - t, 3) * prevX +
                  3 * Math.pow(1 - t, 2) * t * (baseX + cmd.x1 * scale) +
                  3 * (1 - t) * t * t * (baseX + cmd.x2 * scale) +
                  Math.pow(t, 3) * (baseX + cmd.x * scale);
                ty =
                  Math.pow(1 - t, 3) * prevY +
                  3 * Math.pow(1 - t, 2) * t * (baseY - cmd.y1 * scale) +
                  3 * (1 - t) * t * t * (baseY - cmd.y2 * scale) +
                  Math.pow(t, 3) * (baseY - cmd.y * scale);
              }
              if (tx !== prevX || ty !== prevY) {
                gcode += `G1 X${tx.toFixed(3)}Y${ty.toFixed(3)}F20000\n`;
                prevX = tx;
                prevY = ty;
              }
            }
          } else if (cmd.type === SVGPathData.CLOSE_PATH) {
            if (penDown) {
              gcode += `G1G90 Z1.0F20000\n`;
              penDown = false;
            }
          }
        }

        // Retract pen after glyph
        if (penDown) {
          gcode += `G1G90 Z1.0F20000\n`;
          penDown = false;
        }

        // Update X position
        baseX += glyph.advanceWidth * scale + letterSpacing;
      }
    }

    // Finalize G-code
    gcode += [
      'G1G90 Z1.0F20000',
      'G90 G0 X0 Y0',
      'M30',
    ].join('\n') + '\n';

    res.status(200).json({ gcode });
  } catch (error) {
    console.error('Error generating G-code:', error);
    res.status(500).json({ error: `Failed to generate G-code: ${error.message}` });
  }
}