# compolines

A browser-based tool for collecting perceived composition lines on images. Participants view images one at a time on a tablet and draw the lines they consider most important for the composition, either as straight lines or as freehand curves. Each line is saved as a cubic Bézier curve in the pixel coordinates of the original image, together with its drawing mode and a timestamp.

Developed at the [Lab for Cognitive Research in Art History (CReA)](https://crea.univie.ac.at/), Department of Art History, University of Vienna.

> Long, Xingyu, Chao-Shan Hsu, Regina Balázs, Ádám Salomvári, Sophia Kury, and Raphael Rosenberg. **Unsichere Blicke, feste Striche: Kompositionszeichnen als Verhaltenserhebung für empirische Bildwissenschaft.** Poster accepted for *DHd 2027: Mind the Gap! – Wissen, Unsicherheit und Verantwortung*, Marburg, March 1–5, 2027.

## Usage

```
pip install -r requirements.txt
python app.py
```

Put the images into `stimuli/` (JPEG or PNG) before starting. The server prints a network address; open it in the browser of a tablet on the same network. Images are presented in a random order per participant. Results are written to `output/<participant_id>/`: `compolines.csv` holds one row per line, `compolines_order.csv` the presentation order.

## Background

Drawing composition lines has been used as a method in several CReA studies:

- Kury, Sophia, Xingyu Long, Jozsef Arato, Teresa Kamencek, Anna Miscenà, and Raphael Rosenberg. **Visual Guidance of Pictorial Composition in the Absence of Figures: An Eye-Tracking Study.** PsyArXiv, 2026. <https://doi.org/10.31234/osf.io/v6ruk_v1>.
- Long, Xingyu, Jozsef Arato, Sophia Kury, Anna Miscena, and Raphael Rosenberg. **HeatMatch: Orientation-Aware Visualization and Comparison of Very Dense Saccade Patterns.** *Proceedings of the ACM on Computer Graphics and Interactive Techniques* 9, no. 2 (2026): 18. <https://doi.org/10.1145/3803539>.
- Rosenberg, Raphael. **What Guides the Beholder's Eye: Figures, Ground, or Perspective?** In *Between Figure and Ground: Seeing in Premodernity*, edited by Saskia C. Quené, 471–96. Berlin and Boston: Deutscher Kunstverlag, 2025. <https://doi.org/10.1515/9783422801226-015>.
- Sancarlo, Rosa, Zoya Dare, Jozsef Arato, and Raphael Rosenberg. **Does Pictorial Composition Guide the Eye? Investigating Four Centuries of Last Supper Pictures.** *Journal of Eye Movement Research* 13, no. 2 (2020): 7. <https://doi.org/10.16910/jemr.13.2.7>.

## License

MIT
