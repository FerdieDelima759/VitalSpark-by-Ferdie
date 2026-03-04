export type MuscleGroup =
    | "arms"
    | "back"
    | "chest"
    | "core"
    | "full_body"
    | "glutes"
    | "leg"
    | "lower_body"
    | "muscular_body"
    | "shoulder"
    | "upper_body";

export type Gender = "male" | "female";

export const maleMuscularDiagrams = {
    arms: require("./male/male_arms_diagram.png"),
    back: require("./male/male_back_diagram.png"),
    chest: require("./male/male_chest_diagram.png"),
    core: require("./male/male_core_diagram.png"),
    full_body: require("./male/male_full_body_diagram.png"),
    glutes: require("./male/male_glutes_diagram.png"),
    leg: require("./male/male_leg_diagram.png"),
    lower_body: require("./male/male_lower_body_diagram.png"),
    muscular_body: require("./male/male_muscular_body_diagram.png"),
    shoulder: require("./male/male_shoulder_diagram.png"),
    upper_body: require("./male/male_upper_body_diagram.png"),
};

export const femaleMuscularDiagrams = {
    arms: require("./female/female_arms_diagram.png"),
    back: require("./female/female_back_diagram.png"),
    chest: require("./female/female_chest_diagram.png"),
    core: require("./female/female_core_diagram.png"),
    full_body: require("./female/female_full_body_diagram.png"),
    glutes: require("./female/female_glutes_diagram.png"),
    leg: require("./female/female_leg_diagram.png"),
    lower_body: require("./female/female_lower_body_diagram.png"),
    muscular_body: require("./female/female_muscular_body_diagram.png"),
    shoulder: require("./female/female_shoulder_diagram.png"),
    upper_body: require("./female/female_upper_body_diagram.png"),
};

export const muscularDiagrams = {
    male: maleMuscularDiagrams,
    female: femaleMuscularDiagrams,
};

export const getMuscularDiagram = (
    gender: Gender,
    muscleGroup: MuscleGroup
) => {
    return muscularDiagrams[gender][muscleGroup];
};

export const getMuscularDiagramsByGender = (gender: Gender) => {
    return muscularDiagrams[gender];
};

export const getAvailableMuscleGroups = (): MuscleGroup[] => {
    return [
        "arms",
        "back",
        "chest",
        "core",
        "full_body",
        "glutes",
        "leg",
        "lower_body",
        "muscular_body",
        "shoulder",
        "upper_body",
    ];
};

export default muscularDiagrams;

