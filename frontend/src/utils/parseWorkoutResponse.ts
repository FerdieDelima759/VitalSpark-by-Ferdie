/**
 * Parse OpenAI workout response into structured daily workout plans
 */

export interface Exercise {
  name: string;
  details: string; // e.g., "2 sets x 45 seconds, 15 seconds rest"
  target: string; // e.g., "Both sides/whole body"
  instruction: string; // 3-sentence personalized description
}

export interface DailyWorkout {
  dayNumber: number;
  title: string; // e.g., "Daily Workout Plan Title"
  warmup: Exercise[];
  mainWorkout: Exercise[];
  cooldown: Exercise[];
}

/**
 * Parse the workout response text into structured daily workout plans
 * Expected format from OpenAI:
 * ## **Day 1: Lower Body & Core Strength (Monday)**
 * ### **Warm-up**
 * 1. **Jumping Jacks**
 *    - 2 sets x 45 seconds, 15 seconds rest
 *    - Both sides/whole body
 *    - Description text...
 * ### **Main Workout**
 * ...
 * ### **Cooldown**
 * ...
 */
export function parseWorkoutResponse(responseText: string): DailyWorkout[] {
  const workouts: DailyWorkout[] = [];

  // Split by day markers - handle markdown format with optional day of week
  // Pattern: "## **Day #: Title (DayOfWeek)**" or "Day #: Title" or "## Day #: Title"
  const dayPattern = /(?:##\s*)?\*\*?Day\s+(\d+):\s*([^(]+?)(?:\s*\(([^)]+)\))?\*\*?/gi;
  const dayMatches = Array.from(responseText.matchAll(dayPattern));

  if (dayMatches.length === 0) {
    // Try alternative patterns
    const altPattern = /Day\s+(\d+):\s*([^\n(]+?)(?:\s*\(([^)]+)\))?/gi;
    const altMatches = Array.from(responseText.matchAll(altPattern));

    if (altMatches.length === 0) {
      return parseSingleDayWorkout(responseText);
    }

    // Use alternative matches
    for (let i = 0; i < altMatches.length; i++) {
      const match = altMatches[i];
      const dayNumber = parseInt(match[1], 10);
      const title = match[2].trim().replace(/\*\*/g, ''); // Remove bold markers

      const startIndex = match.index! + match[0].length;
      const endIndex = i < altMatches.length - 1
        ? altMatches[i + 1].index!
        : responseText.length;
      const dayContent = responseText.substring(startIndex, endIndex);

      const workout: DailyWorkout = {
        dayNumber,
        title,
        warmup: parseExercises(dayContent, "Warm-up"),
        mainWorkout: parseExercises(dayContent, "Main Workout"),
        cooldown: parseExercises(dayContent, "Cooldown"),
      };

      workouts.push(workout);
    }

    return workouts;
  }

  // Parse each day
  for (let i = 0; i < dayMatches.length; i++) {
    const match = dayMatches[i];
    const dayNumber = parseInt(match[1], 10);
    let title = match[2].trim();
    // Remove markdown bold markers
    title = title.replace(/\*\*/g, '').trim();

    // Get the content for this day (from this match to the next match or end)
    const startIndex = match.index! + match[0].length;
    const endIndex = i < dayMatches.length - 1
      ? dayMatches[i + 1].index!
      : responseText.length;
    const dayContent = responseText.substring(startIndex, endIndex);

    const workout: DailyWorkout = {
      dayNumber,
      title,
      warmup: parseExercises(dayContent, "Warm-up"),
      mainWorkout: parseExercises(dayContent, "Main Workout"),
      cooldown: parseExercises(dayContent, "Cooldown"),
    };

    workouts.push(workout);
  }

  return workouts;
}

/**
 * Parse exercises from a section (Warm-up, Main Workout, or Cooldown)
 * Expected format from OpenAI:
 * ### **Warm-up** or ### Warm-up
 * 1. **Jumping Jacks** or 1. Jumping Jacks
 *    - 2 sets x 45 seconds, 15 seconds rest
 *    - Both sides/whole body
 *    - Description text...
 */
function parseExercises(content: string, sectionName: string): Exercise[] {
  const exercises: Exercise[] = [];

  // Find the section - look for markdown headers (###) or plain text
  // Match section name followed by content until next section or end
  const sectionPattern = new RegExp(
    `(?:###\\s*\\*\\*)?${sectionName}(?:\\*\\*)?[\\s\\S]*?(?=(?:###\\s*\\*\\*)?(?:Main Workout|Warm-up|Cooldown)|(?:##\\s*\\*\\*)?Day\\s+\\d+:|$)`,
    "i"
  );
  const sectionMatch = content.match(sectionPattern);

  if (!sectionMatch) return exercises;

  let sectionContent = sectionMatch[0];
  // Remove the section header (handle markdown and plain text)
  // Handle: "### **Warm-up**", "### Warm-up", "Warm-up", etc.
  sectionContent = sectionContent.replace(
    new RegExp(`(?:###\\s*\\*\\*?)?${sectionName}(?:\\*\\*?)?[\\s\\S]*?\\n`, "i"),
    ""
  );

  // Also remove any horizontal rules (---) that might separate sections
  sectionContent = sectionContent.replace(/^---+\s*\n?/gm, "");

  // Split by numbered exercises (e.g., "1. **Exercise Name**" or "1. Exercise Name")
  // Handle both markdown bold and plain text
  const exerciseBlocks = sectionContent.split(/(?=\d+\.\s+(?:\*\*)?[^\n]+(?:\*\*)?)/);

  for (const block of exerciseBlocks) {
    if (!block.trim()) continue;

    // Extract exercise name - handle bold markdown (**name**) or plain text
    // Pattern: "1. **Name**" or "1. Name" or "1. Name:"
    // Handle cases where the name might be on the same line or next line
    let nameMatch = block.match(/^\d+\.\s*(?:\*\*)?([^\n*]+?)(?:\*\*)?(?:\s*\n|$)/);
    if (!nameMatch) {
      // Try alternative: name might be on next line after number
      nameMatch = block.match(/^\d+\.\s*\n\s*(?:\*\*)?([^\n*]+?)(?:\*\*)?/);
    }
    if (!nameMatch) {
      // Try: number on one line, name with bold on next line
      nameMatch = block.match(/^\d+\.\s*\n\s*\*\*([^*]+)\*\*/);
    }
    if (!nameMatch) {
      // Try: just number, then name on next line without bold
      nameMatch = block.match(/^\d+\.\s*\n\s*([^\n-]+?)(?:\s*\n|$)/);
    }
    if (!nameMatch) continue;

    let name = nameMatch[1].trim();
    // Clean up any remaining markdown and extra formatting
    name = name.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();

    // Remove any trailing colons, asterisks, or special characters
    name = name.replace(/[:*]+$/, '').trim();

    // If name is empty or too short, skip
    if (!name || name.length < 2) continue;

    // Extract the three bullet points (dash format: - text)
    const lines = block.split('\n').map(line => line.trim()).filter(line => line);

    let details = "";
    let target = "";
    let instruction = "";

    // Look for bullet points with dash (-) - can be at start or indented
    const bulletPoints = lines.filter(line => {
      const trimmed = line.trim();
      return /^[-–—]\s+/.test(trimmed) || /^\s+[-–—]\s+/.test(line);
    });

    if (bulletPoints.length >= 1) {
      // First bullet: set, reps, duration, rest
      details = bulletPoints[0]
        .replace(/^[-–—•*]\s+/, "")
        .replace(/^\s+[-–—•*]\s+/, "")
        .trim();
    }

    if (bulletPoints.length >= 2) {
      // Second bullet: per side or target
      target = bulletPoints[1]
        .replace(/^[-–—•*]\s+/, "")
        .replace(/^\s+[-–—•*]\s+/, "")
        .trim();
    }

    if (bulletPoints.length >= 3) {
      // Third bullet: description
      instruction = bulletPoints[2]
        .replace(/^[-–—•*]\s+/, "")
        .replace(/^\s+[-–—•*]\s+/, "")
        .trim();

      // If there are more bullets, they might be continuation of description
      if (bulletPoints.length > 3) {
        const additionalDesc = bulletPoints
          .slice(3)
          .map(bp => bp.replace(/^[-–—•*]\s+/, "").replace(/^\s+[-–—•*]\s+/, "").trim())
          .join(" ");
        instruction = instruction + " " + additionalDesc;
      }
    } else if (bulletPoints.length === 2) {
      // If only 2 bullets, check if second is description (long text)
      const secondBullet = bulletPoints[1]
        .replace(/^[-–—•*]\s+/, "")
        .replace(/^\s+[-–—•*]\s+/, "")
        .trim();
      if (secondBullet.length > 50) {
        instruction = secondBullet;
        target = ""; // No target specified
      }
    }

    // Fallback: if no bullets found, try to extract from lines
    if (!details && !target && !instruction) {
      for (const line of lines) {
        const trimmed = line.replace(/^[-–—•*]\s+/, "").trim();
        if (trimmed.includes('set') || trimmed.includes('rep') || trimmed.includes('second') || trimmed.includes('rest')) {
          details = trimmed;
        } else if (trimmed.toLowerCase().includes('side') || trimmed.toLowerCase().includes('per') || trimmed.toLowerCase().includes('whole body')) {
          target = trimmed;
        } else if (trimmed.length > 30 && !trimmed.match(/^\d+\./)) {
          instruction = (instruction ? instruction + ' ' : '') + trimmed;
        }
      }
    }

    if (name) {
      exercises.push({
        name,
        details: details || "See instructions",
        target: target || "Not specified",
        instruction: instruction || "",
      });
    }
  }

  // Fallback: try simpler pattern if we didn't get any exercises
  if (exercises.length === 0) {
    return parseExercisesSimple(sectionContent);
  }

  return exercises;
}

/**
 * Simpler parsing for exercises when the detailed pattern doesn't match
 */
function parseExercisesSimple(content: string): Exercise[] {
  const exercises: Exercise[] = [];

  // Look for numbered exercises
  const lines = content.split('\n').filter(line => line.trim());

  let currentExercise: Partial<Exercise> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if it's a new exercise (starts with number and period)
    const exerciseMatch = trimmed.match(/^(\d+)\.\s*(.+?):?\s*$/);
    if (exerciseMatch) {
      // Save previous exercise if exists
      if (currentExercise && currentExercise.name) {
        exercises.push({
          name: currentExercise.name,
          details: currentExercise.details || "See instructions",
          target: currentExercise.target || "Not specified",
          instruction: currentExercise.instruction || "",
        });
      }

      // Start new exercise
      currentExercise = {
        name: exerciseMatch[2].trim(),
      };
    } else if (currentExercise) {
      // Add details to current exercise
      if (trimmed.includes('sets') || trimmed.includes('reps') || trimmed.includes('seconds')) {
        currentExercise.details = trimmed.replace(/^[•\-\*]\s*/, '');
      } else if (trimmed.toLowerCase().includes('target') || trimmed.toLowerCase().includes('side')) {
        currentExercise.target = trimmed.replace(/^[•\-\*]\s*/, '');
      } else if (trimmed.length > 20) {
        // Likely the instruction text
        currentExercise.instruction = (currentExercise.instruction || '') + ' ' + trimmed.replace(/^[•\-\*]\s*/, '');
      }
    }
  }

  // Add last exercise
  if (currentExercise && currentExercise.name) {
    exercises.push({
      name: currentExercise.name,
      details: currentExercise.details || "See instructions",
      target: currentExercise.target || "Not specified",
      instruction: currentExercise.instruction?.trim() || "",
    });
  }

  return exercises;
}

/**
 * Parse single day workout (when no "Day X:" markers found)
 */
function parseSingleDayWorkout(responseText: string): DailyWorkout[] {
  // Try to extract warm-up, main workout, and cooldown sections
  const workout: DailyWorkout = {
    dayNumber: 1,
    title: "Workout Plan",
    warmup: parseExercises(responseText, "Warm-up"),
    mainWorkout: parseExercises(responseText, "Main Workout"),
    cooldown: parseExercises(responseText, "Cooldown"),
  };

  // If we still don't have exercises, try to parse the entire text
  if (workout.warmup.length === 0 && workout.mainWorkout.length === 0 && workout.cooldown.length === 0) {
    // Split by common section headers
    const sections = responseText.split(/\n\s*\n/);

    for (const section of sections) {
      if (section.toLowerCase().includes('warm')) {
        workout.warmup = parseExercisesSimple(section);
      } else if (section.toLowerCase().includes('main') || section.toLowerCase().includes('workout')) {
        workout.mainWorkout = parseExercisesSimple(section);
      } else if (section.toLowerCase().includes('cool')) {
        workout.cooldown = parseExercisesSimple(section);
      }
    }
  }

  return workout.warmup.length > 0 || workout.mainWorkout.length > 0 || workout.cooldown.length > 0
    ? [workout]
    : [];
}
