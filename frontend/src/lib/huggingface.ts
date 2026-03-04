// Generate personalized onboarding affirmations based on user profile data
export function generateOnboardingAffirmations(userProfile: {
    preferred_language?: string;
    current_mood?: string;
    first_name?: string;
    nickname?: string;
    [key: string]: any;
}): string[] {
    const { preferred_language, current_mood, first_name, nickname } = userProfile;

    // Base affirmations in different languages
    const affirmations = {
        en: {
            general: [
                "You're taking the first step towards a healthier lifestyle!",
                "Every choice you make brings you closer to your wellness goals.",
                "Your journey to better health starts now.",
                "You have the power to transform your life through small daily actions.",
                "Choosing to prioritize your health shows incredible self-care."
            ],
            personalized: [
                "Welcome aboard, {name}! Your wellness journey begins now.",
                "{name}, you're already showing great commitment to your health!",
                "Hey {name}, every step you take matters on this journey.",
                "{name}, your future self will thank you for starting today!",
                "Wonderful to meet you, {name}! Let's create something amazing together."
            ],
            mood: {
                happy: [
                    "Your positive energy is contagious! Keep shining bright.",
                    "Happiness looks beautiful on you - embrace this wonderful feeling!",
                    "Your joy is a gift to yourself and others around you."
                ],
                calm: [
                    "Peace within yourself creates peace in your life.",
                    "Your calm energy is a superpower in today's busy world.",
                    "Serenity is the foundation of true wellness."
                ],
                energetic: [
                    "Channel that amazing energy into achieving your wellness goals!",
                    "Your vitality is inspiring - use it to create positive change!",
                    "High energy + focused intention = unstoppable progress!"
                ],
                anxious: [
                    "Taking care of yourself is a brave and important step.",
                    "You're stronger than your worries - focus on what you can control.",
                    "Every small step forward is a victory worth celebrating."
                ],
                tired: [
                    "Rest is not a luxury, it's a necessity for your wellbeing.",
                    "Being gentle with yourself is the first step to healing.",
                    "Your body and mind deserve the care you're about to give them."
                ]
            }
        },
        fil: {
            general: [
                "Nagsisimula ka na sa mas malusog na pamumuhay!",
                "Bawat pagpili mo ay nagdadala sa iyo nang mas malapit sa inyong mga layunin sa kalusugan.",
                "Nagsisimula na ang inyong paglalakbay tungo sa mas magandang kalusugan.",
                "May kapangyarihan ka na baguhin ang inyong buhay sa pamamagitan ng mga maliliit na pang-araw-araw na gawain.",
                "Ang pagpili na gawing prayoridad ang inyong kalusugan ay nagpapakita ng kahanga-hangang pag-aalaga sa sarili."
            ],
            personalized: [
                "Maligayang pagdating, {name}! Nagsisimula na ang inyong wellness journey.",
                "{name}, ipinakita mo na ang napakagandang commitment sa inyong kalusugan!",
                "Kumusta {name}, bawat hakbang mo ay mahalaga sa journey na ito.",
                "{name}, magpapasalamat sa inyo ang future self ninyo sa pagsisimula ngayong araw!",
                "Napakaganda na makilala ka, {name}! Gumawa tayo ng magagandang bagay!"
            ],
            mood: {
                happy: [
                    "Ang inyong positibong enerhiya ay nakakahawa! Patuloy na magliwanag.",
                    "Ang kaligayahan ay maganda sa inyo - yakapin ang magandang damdaming ito!",
                    "Ang inyong kagalakan ay regalo sa inyong sarili at sa iba."
                ],
                calm: [
                    "Ang kapayapaan sa loob ninyo ay lumilikha ng kapayapaan sa inyong buhay.",
                    "Ang inyong kalmadong enerhiya ay isang superpower sa abalang mundo ngayon.",
                    "Ang katahimikan ay pundasyon ng tunay na wellness."
                ],
                energetic: [
                    "Gamitin ang kamangha-manghang enerhiya na iyan sa pagkamit ng inyong mga layunin sa wellness!",
                    "Ang inyong sigla ay nakaka-inspire - gamitin ito para lumikha ng positibong pagbabago!",
                    "Mataas na enerhiya + nakatutok na intensyon = hindi mapipigilan na pag-unlad!"
                ],
                anxious: [
                    "Ang pag-aalaga sa sarili ay isang matapang at mahalagang hakbang.",
                    "Mas malakas kayo kaysa sa inyong mga alalahanin - tumuon sa mga bagay na makokontrol ninyo.",
                    "Bawat maliit na hakbang pasulong ay isang tagumpay na karapat-dapat ipagdiwang."
                ],
                tired: [
                    "Ang pahinga ay hindi luho, ito ay pangangailangan para sa inyong kapakanan.",
                    "Ang pagiging maamo sa sarili ay unang hakbang sa pagpapagaling.",
                    "Ang inyong katawan at isip ay karapat-dapat sa pag-aalaga na ibibigay ninyo."
                ]
            }
        },
        es: {
            general: [
                "¡Estás dando el primer paso hacia un estilo de vida más saludable!",
                "Cada elección que haces te acerca más a tus objetivos de bienestar.",
                "Tu viaje hacia una mejor salud comienza ahora.",
                "Tienes el poder de transformar tu vida a través de pequeñas acciones diarias.",
                "Elegir priorizar tu salud muestra un increíble autocuidado."
            ],
            personalized: [
                "¡Bienvenido/a, {name}! Tu viaje de bienestar comienza ahora.",
                "{name}, ¡ya estás mostrando un gran compromiso con tu salud!",
                "Hola {name}, cada paso que das importa en este viaje.",
                "{name}, ¡tu yo futuro te agradecerá por empezar hoy!",
                "¡Qué maravilloso conocerte, {name}! Creemos algo increíble juntos."
            ],
            mood: {
                happy: [
                    "¡Tu energía positiva es contagiosa! Sigue brillando.",
                    "La felicidad te queda hermosa - ¡abraza este sentimiento maravilloso!",
                    "Tu alegría es un regalo para ti y para quienes te rodean."
                ],
                calm: [
                    "La paz interior crea paz en tu vida.",
                    "Tu energía calmada es un superpoder en el mundo agitado de hoy.",
                    "La serenidad es el fundamento del verdadero bienestar."
                ],
                energetic: [
                    "¡Canaliza esa energía increíble hacia el logro de tus metas de bienestar!",
                    "Tu vitalidad es inspiradora - ¡úsala para crear cambios positivos!",
                    "¡Alta energía + intención enfocada = progreso imparable!"
                ],
                anxious: [
                    "Cuidarte a ti mismo es un paso valiente e importante.",
                    "Eres más fuerte que tus preocupaciones - concéntrate en lo que puedes controlar.",
                    "Cada pequeño paso hacia adelante es una victoria que vale la pena celebrar."
                ],
                tired: [
                    "El descanso no es un lujo, es una necesidad para tu bienestar.",
                    "Ser gentil contigo mismo es el primer paso hacia la sanación.",
                    "Tu cuerpo y mente merecen el cuidado que estás a punto de darles."
                ]
            }
        }
    };

    // Get affirmations for selected language, fallback to English
    const selectedLangAffirmations = affirmations[preferred_language as keyof typeof affirmations] || affirmations.en;

    // Determine the name to use for personalization
    const nameToUse = nickname || first_name;

    // Choose affirmation type based on available information
    let selectedAffirmations;
    if (nameToUse && selectedLangAffirmations.personalized) {
        // Use personalized affirmations if name is available
        selectedAffirmations = selectedLangAffirmations.personalized;
    } else if (current_mood && selectedLangAffirmations.mood[current_mood as keyof typeof selectedLangAffirmations.mood]) {
        // Use mood-specific affirmations if mood is available
        selectedAffirmations = selectedLangAffirmations.mood[current_mood as keyof typeof selectedLangAffirmations.mood];
    } else {
        // Fall back to general affirmations
        selectedAffirmations = selectedLangAffirmations.general;
    }

    // Get a random affirmation from the selected array
    const randomIndex = Math.floor(Math.random() * selectedAffirmations.length);
    let affirmation = selectedAffirmations[randomIndex];

    // Replace {name} placeholder with actual name if applicable
    if (nameToUse && affirmation.includes('{name}')) {
        affirmation = affirmation.replace('{name}', nameToUse);
    }

    return [affirmation];
}

// Generate personalized motivational messages for onboarding completion
export function generateOnboardingCompletionMessage(userProfile: {
    nickname?: string;
    full_name?: string;
    current_mood?: string;
    fitness_goal?: string;
    gender?: string;
    preferred_language?: string;
    [key: string]: any;
}): string {
    const { nickname, full_name, current_mood, fitness_goal, gender, preferred_language } = userProfile;

    // Determine the name to use
    const name = nickname || full_name?.split(" ")[0] || "friend";
    const mood = current_mood || "motivated";
    const goal = fitness_goal || "wellness";

    // Short and direct motivational messages organized by language, mood, and goal
    const motivationalMessages = {
        en: {
            moodMessages: {
                happy: "Your positive energy is perfect for this journey!",
                calm: "Your peaceful mindset will guide you to success.",
                energetic: "That energy will fuel your transformation!",
                stressed: "We're here to support you through this.",
                anxious: "Your courage to start shows real strength.",
                confident: "Your confidence will drive your success!",
                motivated: "Channel that motivation into lasting change!"
            },
            goalMessages: {
                weight_loss: "weight loss goals",
                muscle_gain: "muscle building",
                general_fitness: "fitness goals",
                endurance: "endurance training",
                flexibility: "flexibility goals",
                mental_health: "wellness journey"
            },
            template: "{name}, {moodMessage} Let's achieve your {goalMessage} together!"
        },
        es: {
            moodMessages: {
                happy: "¡Tu energía positiva es perfecta para este viaje!",
                calm: "Tu mentalidad pacífica te guiará al éxito.",
                energetic: "¡Esa energía impulsará tu transformación!",
                stressed: "Estamos aquí para apoyarte en esto.",
                anxious: "Tu valentía para empezar muestra verdadera fuerza.",
                confident: "¡Tu confianza impulsará tu éxito!",
                motivated: "¡Canaliza esa motivación en un cambio duradero!"
            },
            goalMessages: {
                weight_loss: "objetivos de pérdida de peso",
                muscle_gain: "desarrollo muscular",
                general_fitness: "objetivos de fitness",
                endurance: "entrenamiento de resistencia",
                flexibility: "objetivos de flexibilidad",
                mental_health: "viaje de bienestar"
            },
            template: "{name}, {moodMessage} ¡Logremos tus {goalMessage} juntos!"
        },
        fil: {
            moodMessages: {
                happy: "Perfect ang inyong positive energy para sa journey na ito!",
                calm: "Ang inyong peaceful mindset ay magdadala sa inyo sa success.",
                energetic: "Ang energy na yan ay magpo-power sa inyong transformation!",
                stressed: "Nandito kami para suportahan kayo dito.",
                anxious: "Ang courage ninyo na magsimula ay nagpapakita ng tunay na strength.",
                confident: "Ang confidence ninyo ay magdadrive sa inyong success!",
                motivated: "I-channel ninyo ang motivation na yan sa lasting change!"
            },
            goalMessages: {
                weight_loss: "weight loss goals",
                muscle_gain: "muscle building",
                general_fitness: "fitness goals",
                endurance: "endurance training",
                flexibility: "flexibility goals",
                mental_health: "wellness journey"
            },
            template: "{name}, {moodMessage} Sama-sama nating maaabot ang inyong {goalMessage}!"
        }
    };

    // Get messages for the preferred language, fallback to English
    const langMessages = motivationalMessages[preferred_language as keyof typeof motivationalMessages] || motivationalMessages.en;

    // Get mood and goal messages
    const moodMessage = langMessages.moodMessages[mood as keyof typeof langMessages.moodMessages] || langMessages.moodMessages.motivated;
    const goalMessage = langMessages.goalMessages[goal as keyof typeof langMessages.goalMessages] || langMessages.goalMessages.general_fitness;

    // Create the final message using the template
    return langMessages.template
        .replace("{name}", name)
        .replace("{moodMessage}", moodMessage)
        .replace("{goalMessage}", goalMessage);
}

