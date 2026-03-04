import { HfInference } from "@huggingface/inference";

// Read token from Expo public env (safe for client distribution per user's request).
// Note: For production secrecy, prefer server-side proxy like a Supabase Edge Function.
const HF_TOKEN = process.env.EXPO_PUBLIC_HUGGINGFACE_API_KEY;

if (!HF_TOKEN) {
    console.warn(
        "Missing EXPO_PUBLIC_HUGGINGFACE_API_KEY. Set it in your env or app config to use Hugging Face directly. Falling back to free tier."
    );
}

// Initialize Hugging Face client - use free tier if no token provided
export const hf = new HfInference(HF_TOKEN || undefined);

// Check if Hugging Face service is available
export async function isHuggingFaceAvailable(): Promise<boolean> {
    try {
        // Test with a simple, fast model
        await hf.textGeneration({
            model: "distilgpt2",
            inputs: "test",
            parameters: { max_new_tokens: 1 },
            options: { wait_for_model: false, use_cache: true }
        });
        return true;
    } catch {
        return false;
    }
}

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

// Generate focused fitness affirmations based on specific fitness data
export function generateFitnessAffirmations(userProfile: {
    fitness_goal?: string;
    fitness_level?: string;
    workout_location?: string;
    equipment_list?: string[];
    workout_duration?: number;
    weekly_frequency?: number;
    current_mood?: string;
    preferred_language?: string;
    has_equipment?: boolean;
    is_beginner?: boolean;
    works_out_at_home?: boolean;
    high_frequency?: boolean;
    short_workouts?: boolean;
    long_workouts?: boolean;
}): string[] {
    const {
        fitness_goal,
        fitness_level,
        workout_location,
        workout_duration,
        weekly_frequency,
        current_mood,
        preferred_language,
        has_equipment,
        is_beginner,
        works_out_at_home,
        high_frequency,
        short_workouts,
        long_workouts
    } = userProfile;

    // Fitness-focused affirmations by language
    const fitnessAffirmations = {
        en: {
            goal_specific: {
                loseWeight: [
                    "Every workout brings you closer to your weight loss goals!",
                    "Your dedication to losing weight shows incredible self-discipline.",
                    "Each healthy choice is a step toward the body you deserve.",
                    "Consistency in your weight loss journey will pay off beautifully."
                ],
                buildMuscle: [
                    "Your muscles grow stronger with every rep and every day!",
                    "Building muscle takes patience, and you're showing amazing commitment.",
                    "Each workout is building the strong, powerful body you're working toward.",
                    "Your dedication to muscle building will transform your strength."
                ],
                improveCardiovascular: [
                    "Your heart gets stronger with every cardio session!",
                    "Building cardiovascular endurance is investing in your long-term health.",
                    "Every heartbeat during exercise is making you healthier.",
                    "Your commitment to cardio health will energize your entire life."
                ],
                increaseStrength: [
                    "You're becoming stronger than you were yesterday!",
                    "Every rep is building the strength you need for life.",
                    "Your dedication to getting stronger shows true determination.",
                    "Strength training is empowering you in every area of life."
                ],
                enhanceFlexibility: [
                    "Flexibility training is giving your body freedom of movement!",
                    "Every stretch is improving your mobility and preventing injury.",
                    "Your commitment to flexibility shows wisdom about body care.",
                    "Enhanced flexibility will improve everything you do physically."
                ],
                getToned: [
                    "Your body is getting more defined with each workout!",
                    "Toning your muscles is creating the physique you envision.",
                    "Every exercise is sculpting your body toward your goals.",
                    "Your dedication to toning will show amazing results."
                ],
                endurance: [
                    "Your endurance is building steadily with every session!",
                    "Each workout is expanding what your body can accomplish.",
                    "Building endurance means you're preparing for anything life brings.",
                    "Your stamina improvements will enhance every aspect of your life."
                ],
                stayHealthy: [
                    "Staying active is the best investment in your future self!",
                    "Your commitment to health shows incredible self-care.",
                    "Every workout is preventing future health problems.",
                    "Maintaining your health through exercise is true wisdom."
                ]
            },
            level_specific: {
                beginner: [
                    "Every expert was once a beginner - you're on the right path!",
                    "Starting your fitness journey takes courage, and you have it!",
                    "Small steps lead to big changes - keep going!",
                    "Your beginner's mindset is actually a superpower for learning."
                ],
                intermediate: [
                    "Your growing fitness knowledge is paying off in real results!",
                    "You've built a solid foundation - now it's time to level up!",
                    "Your consistent effort is moving you from good to great!",
                    "You're developing the habits that create lasting transformation."
                ],
                advanced: [
                    "Your advanced fitness level is inspiring and well-earned!",
                    "You've proven that dedication creates extraordinary results!",
                    "Your commitment to excellence in fitness is remarkable!",
                    "You're showing what's possible with consistent effort and knowledge."
                ]
            },
            location_specific: {
                home: [
                    "Home workouts show incredible self-motivation and resourcefulness!",
                    "You're proving that great fitness doesn't require a gym membership!",
                    "Your dedication to working out at home is truly admirable!",
                    "Creating your fitness routine at home shows real commitment!"
                ],
                gym: [
                    "The gym is your laboratory for building a stronger you!",
                    "You're making the most of all the tools available to reach your goals!",
                    "Your commitment to gym workouts shows serious dedication!",
                    "The gym environment is fueling your fitness transformation!"
                ]
            },
            frequency_specific: {
                high: [
                    "Your high workout frequency shows incredible dedication!",
                    "Training frequently is accelerating your progress beautifully!",
                    "Your commitment to regular exercise is truly inspiring!",
                    "Frequent workouts are building habits that will last a lifetime!"
                ],
                moderate: [
                    "Your consistent workout schedule is perfectly sustainable!",
                    "Regular exercise is creating steady, lasting improvements!",
                    "Your balanced approach to fitness is smart and effective!",
                    "Consistency beats intensity - you're doing this right!"
                ]
            },
            mood_specific: {
                motivated: [
                    "Your motivation is the fuel that will drive amazing results!",
                    "Channel that incredible energy into crushing your fitness goals!",
                    "Your drive and determination are unstoppable forces!",
                    "Motivated energy like yours creates extraordinary transformations!"
                ],
                anxious: [
                    "Exercise is your powerful tool for managing stress and anxiety!",
                    "Every workout helps calm your mind and strengthen your body!",
                    "Physical activity is proven to reduce anxiety - you're doing great!",
                    "Your body will thank you for using exercise to feel better!"
                ],
                tired: [
                    "Even when tired, you're showing up - that's true dedication!",
                    "Gentle movement when tired is still progress worth celebrating!",
                    "Your body will gain energy from this workout, even when starting tired!",
                    "Sometimes the best workouts happen when we push through fatigue!"
                ],
                energetic: [
                    "Your high energy is perfect fuel for an amazing workout!",
                    "Channel that fantastic energy into reaching new fitness heights!",
                    "Your vitality will make this workout feel effortless and fun!",
                    "High energy workouts create the best results and memories!"
                ]
            }
        },
        fil: {
            goal_specific: {
                loseWeight: [
                    "Bawat workout ay nagdadala sa iyo nang mas malapit sa inyong weight loss goals!",
                    "Ang inyong dedication sa pagbabawas ng timbang ay nagpapakita ng kahanga-hangang self-discipline!",
                    "Bawat healthy choice ay hakbang patungo sa katawan na karapat-dapat sa inyo!",
                    "Ang consistency sa inyong weight loss journey ay magkakaroon ng magagandang resulta!"
                ],
                buildMuscle: [
                    "Ang inyong mga muscle ay lumalaki at sumusulong sa bawat rep at araw!",
                    "Ang pagbuo ng muscle ay nangangailangan ng pasensya, at ipinakita ninyo ang kamangha-manghang commitment!",
                    "Bawat workout ay nagtatayo ng malakas at powerful na katawan na pinapangarap ninyo!",
                    "Ang inyong dedication sa muscle building ay magbabago sa inyong lakas!"
                ],
                improveCardiovascular: [
                    "Ang inyong puso ay lumalaki at sumusulong sa bawat cardio session!",
                    "Ang pagbuo ng cardiovascular endurance ay investment sa inyong long-term health!",
                    "Bawat heartbeat habang nag-eexercise ay ginagawa kayong mas healthy!",
                    "Ang inyong commitment sa cardio health ay magbibigay ng energy sa buong buhay ninyo!"
                ],
                increaseStrength: [
                    "Lumalakas kayo kaysa sa nakaraan!",
                    "Bawat rep ay nagtatayo ng lakas na kailangan ninyo sa buhay!",
                    "Ang inyong dedication sa pagiging malakas ay nagpapakita ng tunay na determination!",
                    "Ang strength training ay nagbibigay ng kapangyarihan sa lahat ng aspeto ng buhay!"
                ],
                enhanceFlexibility: [
                    "Ang flexibility training ay nagbibigay ng freedom of movement sa inyong katawan!",
                    "Bawat stretch ay nagpapabuti ng mobility at nagiiwas sa injury!",
                    "Ang inyong commitment sa flexibility ay nagpapakita ng wisdom sa body care!",
                    "Ang enhanced flexibility ay magpapabuti sa lahat ng ginagawa ninyong physical!"
                ],
                getToned: [
                    "Ang inyong katawan ay nagiging mas defined sa bawat workout!",
                    "Ang toning ng muscles ay lumilikha ng physique na iniisip ninyo!",
                    "Bawat exercise ay nagsculpt ng katawan patungo sa inyong mga goals!",
                    "Ang inyong dedication sa toning ay magpapakita ng amazing results!"
                ],
                endurance: [
                    "Ang inyong endurance ay patuloy na tumataas sa bawat session!",
                    "Bawat workout ay nagpapalawak sa kung ano ang kaya ng inyong katawan!",
                    "Ang pagbuo ng endurance ay paghahanda sa lahat ng dadalhin ng buhay!",
                    "Ang mga pagpapabuti sa stamina ay magpapahusay sa lahat ng aspeto ng buhay!"
                ],
                stayHealthy: [
                    "Ang pag-stay active ay best investment sa inyong future self!",
                    "Ang inyong commitment sa health ay nagpapakita ng incredible self-care!",
                    "Bawat workout ay nag-prevent ng future health problems!",
                    "Ang pagmaintain ng health through exercise ay tunay na wisdom!"
                ]
            },
            level_specific: {
                beginner: [
                    "Lahat ng expert ay naging beginner - nasa tamang daan kayo!",
                    "Ang pagsisimula sa fitness journey ay nangangailangan ng courage, at mayroon kayong iyon!",
                    "Ang maliliit na hakbang ay humahantong sa malalaking pagbabago - magpatuloy!",
                    "Ang inyong beginner's mindset ay tunay na superpower para sa pag-aaral!"
                ],
                intermediate: [
                    "Ang inyong lumalaking fitness knowledge ay nagbubunga ng tunay na resulta!",
                    "Nagtayo kayo ng solid foundation - panahon na para mag-level up!",
                    "Ang inyong consistent effort ay naglilipat sa inyo mula sa good patungo sa great!",
                    "Binubuo ninyo ang mga habit na lumilikha ng lasting transformation!"
                ],
                advanced: [
                    "Ang inyong advanced fitness level ay nakaka-inspire at well-earned!",
                    "Napatunayan ninyo na ang dedication ay lumilikha ng extraordinary results!",
                    "Ang inyong commitment sa excellence sa fitness ay remarkable!",
                    "Ipinakita ninyo kung ano ang posible sa consistent effort at knowledge!"
                ]
            },
            location_specific: {
                home: [
                    "Ang home workouts ay nagpapakita ng incredible self-motivation at resourcefulness!",
                    "Napatunayan ninyo na ang great fitness ay hindi nangangailangan ng gym membership!",
                    "Ang inyong dedication sa workout sa bahay ay tunay na admirable!",
                    "Ang paglikha ng fitness routine sa bahay ay nagpapakita ng real commitment!"
                ],
                gym: [
                    "Ang gym ay inyong laboratory para sa pagbuo ng mas malakas na sarili!",
                    "Ginagamit ninyo nang husto ang lahat ng tools na available para maabot ang inyong goals!",
                    "Ang inyong commitment sa gym workouts ay nagpapakita ng serious dedication!",
                    "Ang gym environment ay nagfufuel sa inyong fitness transformation!"
                ]
            },
            frequency_specific: {
                high: [
                    "Ang inyong high workout frequency ay nagpapakita ng incredible dedication!",
                    "Ang frequent training ay nagpapadali sa inyong progress!",
                    "Ang inyong commitment sa regular exercise ay tunay na inspiring!",
                    "Ang frequent workouts ay nagtatayo ng habits na tatagal ng habambuhay!"
                ],
                moderate: [
                    "Ang inyong consistent workout schedule ay perfectly sustainable!",
                    "Ang regular exercise ay lumilikha ng steady, lasting improvements!",
                    "Ang inyong balanced approach sa fitness ay smart at effective!",
                    "Ang consistency ay nananatalo sa intensity - tama ang ginagawa ninyo!"
                ]
            },
            mood_specific: {
                motivated: [
                    "Ang inyong motivation ay fuel na magdadala ng amazing results!",
                    "Gamitin ang incredible energy na iyan sa pag-crush ng fitness goals!",
                    "Ang inyong drive at determination ay unstoppable forces!",
                    "Ang motivated energy tulad ninyo ay lumilikha ng extraordinary transformations!"
                ],
                anxious: [
                    "Ang exercise ay powerful tool ninyo para sa pag-manage ng stress at anxiety!",
                    "Bawat workout ay tumutulong sa pagkalma ng isip at pagpalakas ng katawan!",
                    "Napatunayan na ang physical activity ay nagbabawas ng anxiety - mahusay!",
                    "Magpapasalamat ang katawan ninyo sa paggamit ng exercise para sa pagkakaramdam!"
                ],
                tired: [
                    "Kahit pagod, nandito pa rin kayo - iyan ang tunay na dedication!",
                    "Ang gentle movement kahit pagod ay progress na karapat-dapat ipagdiwang!",
                    "Magkakaroon ng energy ang katawan ninyo mula sa workout na ito!",
                    "Minsan ang best workouts ay nangyayari kapag tuloy pa rin kahit pagod!"
                ],
                energetic: [
                    "Ang inyong high energy ay perfect fuel para sa amazing workout!",
                    "Gamitin ang fantastic energy na iyan sa pag-abot ng new fitness heights!",
                    "Ang inyong vitality ay magpapadali at masaya sa workout na ito!",
                    "Ang high energy workouts ay lumilikha ng best results at memories!"
                ]
            }
        },
        es: {
            goal_specific: {
                loseWeight: [
                    "¡Cada entrenamiento te acerca más a tus metas de pérdida de peso!",
                    "Tu dedicación para perder peso muestra una autodisciplina increíble.",
                    "Cada elección saludable es un paso hacia el cuerpo que mereces.",
                    "La consistencia en tu jornada de pérdida de peso dará hermosos resultados."
                ],
                buildMuscle: [
                    "¡Tus músculos se vuelven más fuertes con cada repetición y cada día!",
                    "Construir músculo requiere paciencia, y estás mostrando un compromiso increíble.",
                    "Cada entrenamiento está construyendo el cuerpo fuerte y poderoso hacia el que trabajas.",
                    "Tu dedicación al desarrollo muscular transformará tu fuerza."
                ],
                improveCardiovascular: [
                    "¡Tu corazón se fortalece con cada sesión de cardio!",
                    "Construir resistencia cardiovascular es invertir en tu salud a largo plazo.",
                    "Cada latido durante el ejercicio te está haciendo más saludable.",
                    "Tu compromiso con la salud cardio energizará toda tu vida."
                ],
                increaseStrength: [
                    "¡Te estás volviendo más fuerte que ayer!",
                    "Cada repetición está construyendo la fuerza que necesitas para la vida.",
                    "Tu dedicación para fortalecerte muestra verdadera determinación.",
                    "El entrenamiento de fuerza te está empoderando en cada área de la vida."
                ],
                enhanceFlexibility: [
                    "¡El entrenamiento de flexibilidad está dando libertad de movimiento a tu cuerpo!",
                    "Cada estiramiento está mejorando tu movilidad y previniendo lesiones.",
                    "Tu compromiso con la flexibilidad muestra sabiduría sobre el cuidado corporal.",
                    "La flexibilidad mejorada mejorará todo lo que hagas físicamente."
                ],
                getToned: [
                    "¡Tu cuerpo se está definiendo más con cada entrenamiento!",
                    "Tonificar tus músculos está creando el físico que visualizas.",
                    "Cada ejercicio está esculpiendo tu cuerpo hacia tus metas.",
                    "Tu dedicación a la tonificación mostrará resultados increíbles."
                ],
                endurance: [
                    "¡Tu resistencia se está construyendo constantemente con cada sesión!",
                    "Cada entrenamiento está expandiendo lo que tu cuerpo puede lograr.",
                    "Construir resistencia significa que te estás preparando para todo lo que la vida traiga.",
                    "Tus mejoras en stamina mejorarán cada aspecto de tu vida."
                ],
                stayHealthy: [
                    "¡Mantenerse activo es la mejor inversión en tu yo futuro!",
                    "Tu compromiso con la salud muestra un autocuidado increíble.",
                    "Cada entrenamiento está previniendo futuros problemas de salud.",
                    "Mantener tu salud a través del ejercicio es verdadera sabiduría."
                ]
            },
            level_specific: {
                beginner: [
                    "¡Todo experto fue una vez principiante - estás en el camino correcto!",
                    "¡Comenzar tu jornada fitness requiere coraje, y lo tienes!",
                    "Los pequeños pasos llevan a grandes cambios - ¡sigue adelante!",
                    "Tu mentalidad de principiante es en realidad un superpoder para aprender."
                ],
                intermediate: [
                    "¡Tu creciente conocimiento fitness está dando resultados reales!",
                    "Has construido una base sólida - ¡ahora es tiempo de subir de nivel!",
                    "Tu esfuerzo consistente te está moviendo de bueno a excelente.",
                    "Estás desarrollando los hábitos que crean transformación duradera."
                ],
                advanced: [
                    "¡Tu nivel fitness avanzado es inspirador y bien merecido!",
                    "¡Has probado que la dedicación crea resultados extraordinarios!",
                    "Tu compromiso con la excelencia en fitness es notable.",
                    "Estás mostrando lo que es posible con esfuerzo consistente y conocimiento."
                ]
            },
            location_specific: {
                home: [
                    "¡Los entrenamientos en casa muestran una automotivación y recursos increíbles!",
                    "¡Estás demostrando que un gran fitness no requiere membresía de gimnasio!",
                    "¡Tu dedicación a entrenar en casa es verdaderamente admirable!",
                    "¡Crear tu rutina de fitness en casa muestra compromiso real!"
                ],
                gym: [
                    "¡El gimnasio es tu laboratorio para construir un tú más fuerte!",
                    "¡Estás aprovechando al máximo todas las herramientas disponibles para alcanzar tus metas!",
                    "¡Tu compromiso con los entrenamientos de gimnasio muestra dedicación seria!",
                    "¡El ambiente del gimnasio está alimentando tu transformación fitness!"
                ]
            },
            frequency_specific: {
                high: [
                    "¡Tu alta frecuencia de entrenamiento muestra dedicación increíble!",
                    "¡Entrenar frecuentemente está acelerando tu progreso hermosamente!",
                    "¡Tu compromiso con el ejercicio regular es verdaderamente inspirador!",
                    "¡Los entrenamientos frecuentes están construyendo hábitos que durarán toda la vida!"
                ],
                moderate: [
                    "¡Tu horario de entrenamiento consistente es perfectamente sostenible!",
                    "¡El ejercicio regular está creando mejoras constantes y duraderas!",
                    "¡Tu enfoque equilibrado al fitness es inteligente y efectivo!",
                    "¡La consistencia vence a la intensidad - lo estás haciendo bien!"
                ]
            },
            mood_specific: {
                motivated: [
                    "¡Tu motivación es el combustible que impulsará resultados increíbles!",
                    "¡Canaliza esa energía increíble para arrasar con tus metas fitness!",
                    "¡Tu impulso y determinación son fuerzas imparables!",
                    "¡La energía motivada como la tuya crea transformaciones extraordinarias!"
                ],
                anxious: [
                    "¡El ejercicio es tu herramienta poderosa para manejar el estrés y la ansiedad!",
                    "¡Cada entrenamiento ayuda a calmar tu mente y fortalecer tu cuerpo!",
                    "¡Está comprobado que la actividad física reduce la ansiedad - lo estás haciendo genial!",
                    "¡Tu cuerpo te agradecerá por usar el ejercicio para sentirte mejor!"
                ],
                tired: [
                    "¡Incluso cuando estás cansado, te presentas - esa es verdadera dedicación!",
                    "¡El movimiento suave cuando estás cansado sigue siendo progreso que vale la pena celebrar!",
                    "¡Tu cuerpo ganará energía de este entrenamiento, incluso empezando cansado!",
                    "¡A veces los mejores entrenamientos suceden cuando superamos la fatiga!"
                ],
                energetic: [
                    "¡Tu alta energía es el combustible perfecto para un entrenamiento increíble!",
                    "¡Canaliza esa energía fantástica para alcanzar nuevas alturas fitness!",
                    "¡Tu vitalidad hará que este entrenamiento se sienta sin esfuerzo y divertido!",
                    "¡Los entrenamientos de alta energía crean los mejores resultados y recuerdos!"
                ]
            }
        }
    };

    // Get affirmations for selected language, fallback to English
    const selectedLangAffirmations = fitnessAffirmations[preferred_language as keyof typeof fitnessAffirmations] || fitnessAffirmations.en;

    // Build affirmation pool based on user's fitness profile
    let affirmationPool: string[] = [];

    // Add goal-specific affirmations if available
    if (fitness_goal && selectedLangAffirmations.goal_specific[fitness_goal as keyof typeof selectedLangAffirmations.goal_specific]) {
        affirmationPool.push(...selectedLangAffirmations.goal_specific[fitness_goal as keyof typeof selectedLangAffirmations.goal_specific]);
    }

    // Add level-specific affirmations if available
    if (fitness_level && selectedLangAffirmations.level_specific[fitness_level as keyof typeof selectedLangAffirmations.level_specific]) {
        affirmationPool.push(...selectedLangAffirmations.level_specific[fitness_level as keyof typeof selectedLangAffirmations.level_specific]);
    }

    // Add location-specific affirmations if available
    if (workout_location && selectedLangAffirmations.location_specific && selectedLangAffirmations.location_specific[workout_location as keyof typeof selectedLangAffirmations.location_specific]) {
        affirmationPool.push(...selectedLangAffirmations.location_specific[workout_location as keyof typeof selectedLangAffirmations.location_specific]);
    }

    // Add frequency-specific affirmations
    if (selectedLangAffirmations.frequency_specific) {
        if (high_frequency && selectedLangAffirmations.frequency_specific.high) {
            affirmationPool.push(...selectedLangAffirmations.frequency_specific.high);
        } else if (weekly_frequency && weekly_frequency >= 3 && selectedLangAffirmations.frequency_specific.moderate) {
            affirmationPool.push(...selectedLangAffirmations.frequency_specific.moderate);
        }
    }

    // Add mood-specific affirmations if available
    if (current_mood && selectedLangAffirmations.mood_specific && selectedLangAffirmations.mood_specific[current_mood as keyof typeof selectedLangAffirmations.mood_specific]) {
        affirmationPool.push(...selectedLangAffirmations.mood_specific[current_mood as keyof typeof selectedLangAffirmations.mood_specific]);
    }

    // If no specific affirmations match, use general fitness affirmations
    if (affirmationPool.length === 0) {
        const generalFitnessAffirmations = {
            en: [
                "Your commitment to fitness is transforming your life!",
                "Every workout is an investment in your future self!",
                "You're building strength, inside and out!",
                "Your dedication to health shows incredible self-care!"
            ],
            fil: [
                "Ang inyong commitment sa fitness ay nagbabago sa inyong buhay!",
                "Bawat workout ay investment sa inyong future self!",
                "Binubuo ninyo ang lakas, sa loob at labas!",
                "Ang inyong dedication sa health ay nagpapakita ng kahanga-hangang self-care!"
            ],
            es: [
                "¡Tu compromiso con el fitness está transformando tu vida!",
                "¡Cada entrenamiento es una inversión en tu yo futuro!",
                "¡Estás construyendo fuerza, por dentro y por fuera!",
                "¡Tu dedicación a la salud muestra un autocuidado increíble!"
            ]
        };

        affirmationPool = generalFitnessAffirmations[preferred_language as keyof typeof generalFitnessAffirmations] || generalFitnessAffirmations.en;
    }

    // Select a random affirmation from the pool
    const randomIndex = Math.floor(Math.random() * affirmationPool.length);
    return [affirmationPool[randomIndex]];
}

// Generate focused dietary affirmations based on specific dietary data
export function generateDietaryAffirmations(userProfile: {
    dietary_preference?: string;
    weekly_budget?: number;
    currency?: string;
    meal_plan_duration?: string;
    health_conditions?: string[];
    current_mood?: string;
    preferred_language?: string;
    has_health_conditions?: boolean;
    is_budget_conscious?: boolean;
    has_dietary_restrictions?: boolean;
    prefers_cultural_food?: boolean;
}): string[] {
    const {
        dietary_preference,
        weekly_budget,
        health_conditions,
        current_mood,
        preferred_language,
        has_health_conditions,
        is_budget_conscious,
        has_dietary_restrictions,
        prefers_cultural_food
    } = userProfile;

    // Dietary-focused affirmations by language
    const dietaryAffirmations = {
        en: {
            preference_specific: {
                vegan: [
                    "Your plant-based choices are nourishing your body and the planet!",
                    "Every vegan meal is a powerful step toward better health and sustainability.",
                    "Your commitment to plant-based eating shows incredible compassion and wisdom.",
                    "Vegan nutrition is fueling your body with vibrant, natural energy!"
                ],
                keto: [
                    "Your keto lifestyle is transforming how your body uses energy!",
                    "Every keto-friendly choice is supporting your metabolic health goals.",
                    "Your dedication to ketogenic eating shows real commitment to wellness.",
                    "The keto journey requires discipline, and you're showing amazing strength!"
                ],
                paleo: [
                    "Your paleo approach honors how humans are meant to eat naturally!",
                    "Every whole food choice is connecting you with ancestral nutrition wisdom.",
                    "Your commitment to unprocessed foods is giving your body pure fuel.",
                    "The paleo lifestyle is helping you build a foundation of real health!"
                ],
                mediterranean: [
                    "The Mediterranean way celebrates food as medicine and joy!",
                    "Your heart and brain are thriving on this time-tested dietary pattern.",
                    "Every Mediterranean meal is a beautiful balance of nutrition and pleasure.",
                    "You're embracing one of the world's healthiest eating traditions!"
                ],
                balanced: [
                    "Your balanced approach to eating shows true nutritional wisdom!",
                    "Finding harmony in your food choices creates sustainable health habits.",
                    "Your commitment to balance allows for both nourishment and enjoyment.",
                    "A balanced diet is the foundation of lifelong wellness!"
                ],
                glutenFree: [
                    "Your gluten-free choices are supporting your body's unique needs!",
                    "Every gluten-free meal is caring for your digestive health and wellbeing.",
                    "Your dedication to gluten-free eating shows great self-awareness.",
                    "You're creating a diet that truly works for your individual body!"
                ],
                flexitarian: [
                    "Your flexible approach to plant-based eating is perfectly sustainable!",
                    "The flexitarian path offers the best of both nutritional worlds.",
                    "Your mindful balance of plants and proteins shows dietary wisdom.",
                    "Flexibility in eating creates joy while supporting your health goals!"
                ],
                filipinoHeritage: [
                    "Honoring your Filipino food heritage connects you to culture and nutrition!",
                    "Traditional Filipino foods can be both delicious and incredibly nourishing.",
                    "Your cultural food choices celebrate identity while supporting wellness.",
                    "Filipino cuisine offers amazing flavors and nutritional variety!"
                ]
            },
            budget_specific: {
                budget_conscious: [
                    "Eating well on a budget shows incredible resourcefulness and planning!",
                    "Healthy eating doesn't require expensive ingredients - you're proving that!",
                    "Your smart budgeting approach makes nutrition accessible and sustainable.",
                    "Creative, budget-friendly meals can be the most satisfying and nutritious!"
                ],
                comfortable_budget: [
                    "Your food budget allows for wonderful variety and nutritional exploration!",
                    "Having flexibility in food choices opens doors to culinary adventures.",
                    "Your investment in quality nutrition is an investment in your health.",
                    "A comfortable food budget lets you prioritize both health and enjoyment!"
                ]
            },
            health_specific: {
                has_conditions: [
                    "Using nutrition to support your health conditions shows real wisdom!",
                    "Every mindful food choice is a powerful tool in managing your wellbeing.",
                    "Your proactive approach to nutrition-based health management is inspiring.",
                    "Food can be medicine, and you're choosing healing with every meal!"
                ],
                general_wellness: [
                    "Your preventive approach to nutrition is investing in your future health!",
                    "Every nutritious choice is building a foundation of lifelong wellness.",
                    "Your commitment to healthy eating is one of the best gifts to yourself.",
                    "Nutrition is self-care in its most fundamental and powerful form!"
                ]
            },
            cultural_specific: {
                heritage_focused: [
                    "Celebrating your food heritage while pursuing health shows beautiful balance!",
                    "Cultural foods can be incredibly nutritious when prepared mindfully.",
                    "Your connection to traditional foods honors both ancestry and wellness.",
                    "Food culture and health goals can work together harmoniously!"
                ]
            }
        },
        fil: {
            preference_specific: {
                vegan: [
                    "Ang inyong plant-based na mga pagpili ay nag-nourish sa katawan at planeta!",
                    "Bawat vegan meal ay powerful step tungo sa mas magandang kalusugan at sustainability.",
                    "Ang inyong commitment sa plant-based eating ay nagpapakita ng incredible compassion at wisdom.",
                    "Ang vegan nutrition ay nagbibigay ng vibrant, natural energy sa katawan!"
                ],
                keto: [
                    "Ang inyong keto lifestyle ay binabago kung paano ginagamit ng katawan ang energy!",
                    "Bawat keto-friendly choice ay sumusuporta sa inyong metabolic health goals.",
                    "Ang inyong dedication sa ketogenic eating ay nagpapakita ng tunay na commitment sa wellness.",
                    "Ang keto journey ay nangangailangan ng discipline, at nagpapakita kayo ng amazing strength!"
                ],
                paleo: [
                    "Ang inyong paleo approach ay gumagalang sa natural na paraan ng pagkain ng tao!",
                    "Bawat whole food choice ay nagkokonekta sa inyo sa ancestral nutrition wisdom.",
                    "Ang inyong commitment sa unprocessed foods ay nagbibigay ng pure fuel sa katawan.",
                    "Ang paleo lifestyle ay tumutulong sa inyo na makabuo ng foundation ng tunay na health!"
                ],
                mediterranean: [
                    "Ang Mediterranean way ay nagdiriwang ng food bilang medicine at joy!",
                    "Ang puso at utak ninyo ay umuunlad sa time-tested dietary pattern na ito.",
                    "Bawat Mediterranean meal ay magandang balance ng nutrition at pleasure.",
                    "Yakap ninyo ang isa sa pinaka-healthy na eating traditions sa mundo!"
                ],
                balanced: [
                    "Ang inyong balanced approach sa pagkain ay nagpapakita ng tunay na nutritional wisdom!",
                    "Ang paghahanap ng harmony sa food choices ay lumilikha ng sustainable health habits.",
                    "Ang inyong commitment sa balance ay nagbibigay-daan sa nourishment at enjoyment.",
                    "Ang balanced diet ay foundation ng lifelong wellness!"
                ],
                glutenFree: [
                    "Ang inyong gluten-free choices ay sumusuporta sa unique needs ng katawan!",
                    "Bawat gluten-free meal ay nag-aalaga sa digestive health at wellbeing.",
                    "Ang inyong dedication sa gluten-free eating ay nagpapakita ng great self-awareness.",
                    "Lumililikha kayo ng diet na tunay na gumagana para sa individual na katawan ninyo!"
                ],
                flexitarian: [
                    "Ang inyong flexible approach sa plant-based eating ay perfectly sustainable!",
                    "Ang flexitarian path ay nag-offer ng best ng dalawang nutritional worlds.",
                    "Ang inyong mindful balance ng plants at proteins ay nagpapakita ng dietary wisdom.",
                    "Ang flexibility sa pagkain ay lumilikha ng joy habang sumusuporta sa health goals!"
                ],
                filipinoHeritage: [
                    "Ang paggalang sa Filipino food heritage ay nagkokonekta sa kultura at nutrition!",
                    "Ang traditional Filipino foods ay maaaring maging masarap at napaka-nourishing.",
                    "Ang inyong cultural food choices ay nagdiriwang ng identity habang sumusuporta sa wellness.",
                    "Ang Filipino cuisine ay nag-offer ng amazing flavors at nutritional variety!"
                ]
            },
            budget_specific: {
                budget_conscious: [
                    "Ang healthy eating sa budget ay nagpapakita ng incredible resourcefulness at planning!",
                    "Ang healthy eating ay hindi nangangailangan ng expensive ingredients - pinapatunayan ninyo iyan!",
                    "Ang inyong smart budgeting approach ay gumagawa ng nutrition na accessible at sustainable.",
                    "Ang creative, budget-friendly meals ay maaaring pinakamasarap at nutritious!"
                ],
                comfortable_budget: [
                    "Ang inyong food budget ay nagbibigay-daan sa wonderful variety at nutritional exploration!",
                    "Ang pagkakaroon ng flexibility sa food choices ay nagbubukas ng pintuan sa culinary adventures.",
                    "Ang inyong investment sa quality nutrition ay investment sa inyong health.",
                    "Ang comfortable food budget ay nagbibigay-daan sa pag-prioritize ng health at enjoyment!"
                ]
            },
            health_specific: {
                has_conditions: [
                    "Ang paggamit ng nutrition para suportahan ang health conditions ay tunay na wisdom!",
                    "Bawat mindful food choice ay powerful tool sa pag-manage ng wellbeing.",
                    "Ang inyong proactive approach sa nutrition-based health management ay inspiring.",
                    "Ang food ay maaaring medicine, at pumipili kayo ng healing sa bawat meal!"
                ],
                general_wellness: [
                    "Ang inyong preventive approach sa nutrition ay investment sa future health!",
                    "Bawat nutritious choice ay nagtatayo ng foundation ng lifelong wellness.",
                    "Ang inyong commitment sa healthy eating ay isa sa best gifts sa sarili.",
                    "Ang nutrition ay self-care sa pinaka-fundamental at powerful na form!"
                ]
            },
            cultural_specific: {
                heritage_focused: [
                    "Ang pagdiriwang ng food heritage habang pursuit ng health ay nagpapakita ng beautiful balance!",
                    "Ang cultural foods ay maaaring incredible nutritious kapag mindfully prepared.",
                    "Ang inyong connection sa traditional foods ay gumagalang sa ancestry at wellness.",
                    "Ang food culture at health goals ay maaaring magtulungan nang harmoniously!"
                ]
            }
        },
        es: {
            preference_specific: {
                vegan: [
                    "¡Tus elecciones basadas en plantas nutren tu cuerpo y el planeta!",
                    "Cada comida vegana es un paso poderoso hacia mejor salud y sostenibilidad.",
                    "Tu compromiso con la alimentación basada en plantas muestra increíble compasión y sabiduría.",
                    "¡La nutrición vegana está alimentando tu cuerpo con energía vibrante y natural!"
                ],
                keto: [
                    "¡Tu estilo de vida keto está transformando cómo tu cuerpo usa la energía!",
                    "Cada elección keto-friendly está apoyando tus metas de salud metabólica.",
                    "Tu dedicación a la alimentación cetogénica muestra un compromiso real con el bienestar.",
                    "¡El viaje keto requiere disciplina, y estás mostrando una fuerza increíble!"
                ],
                paleo: [
                    "¡Tu enfoque paleo honra cómo los humanos están destinados a comer naturalmente!",
                    "Cada elección de alimento integral te conecta con la sabiduría nutricional ancestral.",
                    "Tu compromiso con alimentos no procesados está dando combustible puro a tu cuerpo.",
                    "¡El estilo de vida paleo te está ayudando a construir una base de salud real!"
                ],
                mediterranean: [
                    "¡La manera mediterránea celebra la comida como medicina y alegría!",
                    "Tu corazón y cerebro están prosperando con este patrón dietético probado por el tiempo.",
                    "Cada comida mediterránea es un hermoso equilibrio de nutrición y placer.",
                    "¡Estás abrazando una de las tradiciones alimentarias más saludables del mundo!"
                ],
                balanced: [
                    "¡Tu enfoque equilibrado de la alimentación muestra verdadera sabiduría nutricional!",
                    "Encontrar armonía en tus elecciones alimentarias crea hábitos de salud sostenibles.",
                    "Tu compromiso con el equilibrio permite tanto nutrición como disfrute.",
                    "¡Una dieta equilibrada es la base del bienestar de por vida!"
                ],
                glutenFree: [
                    "¡Tus elecciones sin gluten están apoyando las necesidades únicas de tu cuerpo!",
                    "Cada comida sin gluten está cuidando tu salud digestiva y bienestar.",
                    "Tu dedicación a la alimentación sin gluten muestra gran autoconciencia.",
                    "¡Estás creando una dieta que realmente funciona para tu cuerpo individual!"
                ],
                flexitarian: [
                    "¡Tu enfoque flexible hacia la alimentación basada en plantas es perfectamente sostenible!",
                    "El camino flexitariano ofrece lo mejor de ambos mundos nutricionales.",
                    "Tu equilibrio consciente de plantas y proteínas muestra sabiduría dietética.",
                    "¡La flexibilidad en la alimentación crea alegría mientras apoya tus metas de salud!"
                ],
                filipinoHeritage: [
                    "¡Honrar tu herencia alimentaria filipina te conecta con la cultura y la nutrición!",
                    "Los alimentos tradicionales filipinos pueden ser deliciosos e increíblemente nutritivos.",
                    "Tus elecciones alimentarias culturales celebran la identidad mientras apoyan el bienestar.",
                    "¡La cocina filipina ofrece sabores increíbles y variedad nutricional!"
                ]
            },
            budget_specific: {
                budget_conscious: [
                    "¡Comer bien con presupuesto muestra increíble ingenio y planificación!",
                    "La alimentación saludable no requiere ingredientes caros - ¡lo estás demostrando!",
                    "Tu enfoque inteligente de presupuesto hace la nutrición accesible y sostenible.",
                    "¡Las comidas creativas y económicas pueden ser las más satisfactorias y nutritivas!"
                ],
                comfortable_budget: [
                    "¡Tu presupuesto alimentario permite una variedad maravillosa y exploración nutricional!",
                    "Tener flexibilidad en las elecciones alimentarias abre puertas a aventuras culinarias.",
                    "Tu inversión en nutrición de calidad es una inversión en tu salud.",
                    "¡Un presupuesto alimentario cómodo te permite priorizar tanto salud como disfrute!"
                ]
            },
            health_specific: {
                has_conditions: [
                    "¡Usar la nutrición para apoyar tus condiciones de salud muestra verdadera sabiduría!",
                    "Cada elección alimentaria consciente es una herramienta poderosa para manejar tu bienestar.",
                    "Tu enfoque proactivo hacia el manejo de salud basado en nutrición es inspirador.",
                    "¡La comida puede ser medicina, y estás eligiendo sanación con cada comida!"
                ],
                general_wellness: [
                    "¡Tu enfoque preventivo hacia la nutrición está invirtiendo en tu salud futura!",
                    "Cada elección nutritiva está construyendo una base de bienestar de por vida.",
                    "Tu compromiso con la alimentación saludable es uno de los mejores regalos para ti mismo.",
                    "¡La nutrición es autocuidado en su forma más fundamental y poderosa!"
                ]
            },
            cultural_specific: {
                heritage_focused: [
                    "¡Celebrar tu herencia alimentaria mientras persigues la salud muestra un hermoso equilibrio!",
                    "Los alimentos culturales pueden ser increíblemente nutritivos cuando se preparan conscientemente.",
                    "Tu conexión con alimentos tradicionales honra tanto la ascendencia como el bienestar.",
                    "¡La cultura alimentaria y las metas de salud pueden trabajar juntas armoniosamente!"
                ]
            }
        }
    };

    // Get affirmations for selected language, fallback to English
    const selectedLangAffirmations = dietaryAffirmations[preferred_language as keyof typeof dietaryAffirmations] || dietaryAffirmations.en;

    // Build affirmation pool based on user's dietary profile
    let affirmationPool: string[] = [];

    // Add preference-specific affirmations if available
    if (dietary_preference && selectedLangAffirmations.preference_specific[dietary_preference as keyof typeof selectedLangAffirmations.preference_specific]) {
        affirmationPool.push(...selectedLangAffirmations.preference_specific[dietary_preference as keyof typeof selectedLangAffirmations.preference_specific]);
    }

    // Add budget-specific affirmations if available
    if (selectedLangAffirmations.budget_specific) {
        if (is_budget_conscious && selectedLangAffirmations.budget_specific.budget_conscious) {
            affirmationPool.push(...selectedLangAffirmations.budget_specific.budget_conscious);
        } else if (!is_budget_conscious && selectedLangAffirmations.budget_specific.comfortable_budget) {
            affirmationPool.push(...selectedLangAffirmations.budget_specific.comfortable_budget);
        }
    }

    // Add health-specific affirmations if available
    if (selectedLangAffirmations.health_specific) {
        if (has_health_conditions && selectedLangAffirmations.health_specific.has_conditions) {
            affirmationPool.push(...selectedLangAffirmations.health_specific.has_conditions);
        } else if (selectedLangAffirmations.health_specific.general_wellness) {
            affirmationPool.push(...selectedLangAffirmations.health_specific.general_wellness);
        }
    }

    // Add cultural-specific affirmations if available
    if (prefers_cultural_food && selectedLangAffirmations.cultural_specific && selectedLangAffirmations.cultural_specific.heritage_focused) {
        affirmationPool.push(...selectedLangAffirmations.cultural_specific.heritage_focused);
    }

    // If no specific affirmations match, use general dietary affirmations
    if (affirmationPool.length === 0) {
        const generalDietaryAffirmations = {
            en: [
                "Your commitment to mindful eating is transforming your relationship with food!",
                "Every nutritious choice is an investment in your long-term health and vitality!",
                "You're building sustainable eating habits that will serve you for life!",
                "Your dedication to good nutrition shows incredible self-care and wisdom!"
            ],
            fil: [
                "Ang inyong commitment sa mindful eating ay binabago ang relationship ninyo sa food!",
                "Bawat nutritious choice ay investment sa inyong long-term health at vitality!",
                "Binubuo ninyo ang sustainable eating habits na maglilingkod sa inyo habambuhay!",
                "Ang inyong dedication sa good nutrition ay nagpapakita ng incredible self-care at wisdom!"
            ],
            es: [
                "¡Tu compromiso con la alimentación consciente está transformando tu relación con la comida!",
                "¡Cada elección nutritiva es una inversión en tu salud y vitalidad a largo plazo!",
                "¡Estás construyendo hábitos alimentarios sostenibles que te servirán de por vida!",
                "¡Tu dedicación a la buena nutrición muestra increíble autocuidado y sabiduría!"
            ]
        };

        affirmationPool = generalDietaryAffirmations[preferred_language as keyof typeof generalDietaryAffirmations] || generalDietaryAffirmations.en;
    }

    // Select a random affirmation from the pool
    const randomIndex = Math.floor(Math.random() * affirmationPool.length);
    return [affirmationPool[randomIndex]];
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

