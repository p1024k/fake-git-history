# Generate Git Commits

A command-line tool that generates GitHub or GitLab activity graphs to make it look like you have been coding regularly.

<img src="https://dl.dropboxusercontent.com/s/q2iinti6v0zbhzs/contributions.gif?dl=0" alt="How it works" />

## How To Use

1. Ensure you have [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) and
   [Node.js](https://nodejs.org/en/download/) installed on your machine.
2. Generate your commits:
   ```shell script
   npx fake-git-history
   ```
3. Create [a private repository](https://github.com/new) called `my-history` in your GitHub or GitLab.
4. Push the changes:
   ```shell script
   cd my-history
   git remote add origin git@github.com:<USERNAME>/my-history.git
   git push -u origin main
   ```

Done! Now take a look at your GitHub profile 😉

## Draw Mode (Text & Icons)

Instead of random activity, render a short string of **text** or a built-in **icon** onto a past year's contribution graph.

> For commits to count toward your GitHub contributions, the git author email must be one attached to your GitHub account. Pass it per run with `--user-name` / `--user-email` — the tool sets it **locally in `my-history/` only** and never touches your global git config:
> ```shell script
> npx fake-git-history --text "HI" --year 2025 --user-name "Your Name" --user-email "your-github-account@email.com"
> ```

### Preview first

```shell script
npx fake-git-history --preview --text "HI" --year 2025
```

Prints that year's graph (~53 columns × 7 rows) with the letters shown as dark-green squares, centered. No commits are created.

> The preview uses color to tell lit (green) cells from empty (near-white) cells. If you pipe the output to a file or view it in a non-color terminal, all cells look the same — that's expected.

### Generate

```shell script
npx fake-git-history --text "HI" --year 2025
```

Creates/overwrites a `my-history/` folder with a git repo full of backdated commits, then push it as described in [How To Use](#how-to-use).

> ⚠️ It runs `rm -rf my-history` first if the folder already exists — don't run it somewhere that matters.

### Flags

| Flag | Short | Type | Default | Description |
|---|---|---|---|---|
| `--text` | `-t` | string | — | Text to render (auto-uppercased) |
| `--draw` | — | string | — | Icon name: `cat`, `heart`, `mouse`, `smiley`, `star` |
| `--year` | `-y` | number | last year | Target year, `2000` to `currentYear-1` |
| `--preview` | `-p` | boolean | `false` | Preview without committing |
| `--commitsPerDay` | `-c` | string | `"0,4"` | Commits per lit day (upper bound) |
| `--user-name` | — | string | — | Git author name (set locally in `my-history/`, works in any mode) |
| `--user-email` | — | string | — | Git author email (use one tied to your GitHub account) |

Rules:

- `--text` and `--draw` are mutually exclusive.
- In draw mode, `--frequency` and `--distribution` are ignored, and `--startDate` / `--endDate` are overridden by the target year.
- Without `--text` / `--draw`, the original random behavior runs unchanged.

### Text mode

- Font: 5×5 bitmap, supports **`A–Z`, `0–9`, space**. Input is auto-uppercased.
- Unsupported characters (punctuation, non-ASCII) are skipped with a warning.
- **Max 8 characters** (spaces count). A year has ~53 columns; each character takes ~6.
- Letters land on the Mon–Fri rows (vertically centered) and are horizontally centered.

```shell script
npx fake-git-history --preview --text "CAT"        # OK
npx fake-git-history --preview --text "GIT HUB"    # 7 chars (incl. space), OK
npx fake-git-history --preview --text "I LOVE GIT" # 10 chars -> error
```

### Icon mode

```shell script
npx fake-git-history --preview --draw heart --year 2025
```

Available icons: `cat`, `heart`, `mouse`, `smiley`, `star`. An unknown name lists the available ones.

### Commit density

`--commitsPerDay` (default `"0,4"`) controls how many commits each lit day gets (the upper bound). Raising it (e.g. `-c "0,9"`) makes lit days darker and raises the total count, but the pattern is binary (lit/unlit) and its shape doesn't change. The upper bound must be ≥ 1.

### Notes

- The font is 5×5; a few letters (e.g. `M`, `W`) look blocky. Uppercase letters and digits only.
- The default target year is **last year** (a complete, safe year to render).
- **Preview matches GitHub**: both anchor weeks to Sunday, so what you see in the preview is what shows up on your profile.

## Support This Project

If you rely on this tool and find it useful, please consider supporting it. Maintaining an open source project takes time, and a cup of coffee would be greatly appreciated!

<a href="https://www.buymeacoffee.com/artiebits" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## Customizations

### `--preview`

If you want to preview the activity graph before creating any commits, use the `--preview` flag:

```shell script
npx fake-git-history --preview
```

You can combine it with other options:

```shell script
npx fake-git-history --preview --distribution workHours --frequency 100
```

### `--frequency`

Control the chance (0-100%) of generating commits for each day. This makes your activity graph look more random and realistic.
The default value is `80`, which means commits will be generated for 80% of the days in the date range. Setting a lower value will randomly skip more days:

```shell script
npx fake-git-history --frequency 50
```

This will generate commits for approximately 50% of the days in your date range, making the pattern look more natural.

### `--distribution`

Choose the distribution pattern for generating commits:

- `uniform` (default): Evenly distributed random commits between min and max
- `workHours`: More commits during work hours (9am-5pm) and on weekdays (especially Tuesday-Thursday)
- `afterWork`: More commits during evenings and weekends

#### Work Hours Pattern

For a typical work schedule pattern that shows more activity during weekdays:

```shell script
npx fake-git-history --distribution workHours --preview
```

Days between Tuesday and Thursday will have the most activity, while weekends will be mostly empty.

#### After Work Pattern

For an evening/weekend coder pattern that shows more activity during off-hours:

```shell script
npx fake-git-history --distribution afterWork --preview
```

Saturday and Sunday will have the most activity, with Friday evenings also showing higher commit counts.

### `--startDate` and `--endDate`

By default, the script generates GitHub commits for every day within the last year.
But if you want to generate activity for specific dates, use these options:

```shell script
npx fake-git-history --startDate "2020/09/01" --endDate "2020/09/30"
```

### `--commitsPerDay`

Specify the number of commits to create for each day.
The default is `0,4`,but you can change it:

```shell script
npx fake-git-history --commitsPerDay "0,6"
```

## PS

This tool was created as a joke, so please don't take it seriously. While cheating is never encouraged, if someone is judging your professional skills based on your GitHub activity graph, they deserve to see a rich activity graph 🤓
