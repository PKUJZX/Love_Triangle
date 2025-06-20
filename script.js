// --- State Management ---
const characters = {
    suitorA: { name: "追求者 A", desc: "", profile: "", dialogue: [], totalScore: 0 },
    suitorB: { name: "追求者 B", desc: "", profile: "", dialogue: [], totalScore: 0 },
    judge:   { name: "裁判", desc: "", profile: "", dialogue: [] }
};
let profilesGenerated = 0;
let roundCount = 0;
const MAX_ROUNDS = 5;
let currentEvent = ""; // Holds the current dynamic event

// --- UI Elements ---
const startRoundBtn = document.getElementById('start-round-btn');
const actionStatus = document.getElementById('action-status');

// --- Gemini API Configuration ---
const API_KEY = "";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

/**
 * A helper function to call the Gemini API.
 * @param {object} payload - The payload to send to the API.
 * @param {boolean} isGlobalStatus - Whether to show the status in the main status bar.
 * @returns {Promise<object>} The JSON response from the API.
 */
async function callGeminiAPI(payload, isGlobalStatus = true) {
    if (isGlobalStatus) {
        actionStatus.textContent = '正在与AI通信...';
    }
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("API Error Response:", errorBody);
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }
    const result = await response.json();
     if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
        return result.candidates[0].content.parts[0].text;
    } else {
        console.error("Unexpected API response structure:", result);
        if (result.promptFeedback && result.promptFeedback.blockReason){
            throw new Error(`请求被阻止: ${result.promptFeedback.blockReason}`);
        }
        throw new Error("未能从API获取有效回复。");
    }
}

/**
 * Generates a detailed character profile based on user's brief description.
 * @param {string} role - The role of the character (e.g., 'suitorA').
 */
async function generateProfile(role) {
    const descTextarea = document.getElementById(`desc-${role.replace('suitor', 'suitor-').toLowerCase()}`);
    const profileDiv = document.getElementById(`profile-${role.replace('suitor', 'suitor')}`);
    const desc = descTextarea.value.trim();

    if (!desc) {
        alert("请输入角色的基本描述。");
        return;
    }

    characters[role].desc = desc;
    profileDiv.innerHTML = '<span class="text-gray-400">正在生成角色卡...</span>';

    const prompt = `
        请你扮演一名专业的编剧。根据以下非常简短的角色描述，扩充成一个更加丰富、立体、有吸引力的角色背景介绍。
        介绍应该包含角色的姓名、性格、职业、价值观、以及一些有趣的小秘密或怪癖。让角色看起来更真实可信。
        请用第一人称 "我" 来进行介绍。
        
        原始描述: "${desc}"
    `;

    try {
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
        const generatedProfile = await callGeminiAPI(payload);
        characters[role].profile = generatedProfile;
        profileDiv.textContent = generatedProfile;

        if (!characters[role].isGenerated) {
            characters[role].isGenerated = true;
            profilesGenerated++;
        }
        
        if (profilesGenerated >= 3) {
            startRoundBtn.disabled = false;
            actionStatus.textContent = '所有角色已就绪！可以开始第一回合了。';
        }
    } catch (error) {
        console.error("Error generating profile:", error);
        profileDiv.textContent = `生成失败: ${error.message}`;
         actionStatus.textContent = `生成角色失败: ${error.message}`;
    }
}

/**
 * Generates a random dynamic event using the AI.
 * @returns {Promise<string>} The generated event text.
 */
async function generateDynamicEvent() {
    actionStatus.textContent = '正在生成随机事件...';
    const prompt = `
        请你扮演一名浪漫的场景设计师。
        为一场正在进行的浪漫约会，设计一个简短、有趣的突发事件。
        这个事件应该能激发对话，增加戏剧性或浪漫气氛。
        请只用一句话描述这个事件，不要任何多余的解释。

        例如:
        - 一群鸽子突然从广场上飞起，盘旋在你们头顶。
        - 你们身边的一对老夫妻，突然开始随着远处的音乐跳起了舞。
        - 一位卖花的小女孩害羞地递给被追求者一朵玫瑰。
    `;
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    try {
        const eventText = await callGeminiAPI(payload);
        return eventText.replace(/[\r\n]+/g, ' ').trim();
    } catch (error) {
         console.error("Error generating dynamic event:", error);
         actionStatus.textContent = `生成事件失败: ${error.message}`;
         return "天空突然下起了淅淅沥沥的小雨，空气中弥漫着泥土的芬芳。";
    }
}


/**
 * Starts a round of dialogue and judging, or ends the game.
 */
async function startRound() {
    if (profilesGenerated < 3) {
        alert("请先为所有三个角色生成角色卡。");
        return;
    }

    if (roundCount >= MAX_ROUNDS) {
        endGame();
        return;
    }

    roundCount++;
    startRoundBtn.disabled = true;
    
    document.getElementById('event-section').classList.remove('hidden');
    document.getElementById('event-text').textContent = "正在构思突发事件...";
    currentEvent = await generateDynamicEvent();
    document.getElementById('event-text').textContent = currentEvent;
    
    actionStatus.textContent = `第 ${roundCount} 回合进行中... 突发事件！正在等待追求者发言...`;

    try {
        const suitorAPromise = getSuitorDialogue('suitorA', currentEvent);
        const suitorBPromise = getSuitorDialogue('suitorB', currentEvent);
        const [dialogueA, dialogueB] = await Promise.all([suitorAPromise, suitorBPromise]);

        characters.suitorA.dialogue.push(dialogueA);
        characters.suitorB.dialogue.push(dialogueB);

        updateDialogueUI('suitorA', dialogueA);
        updateDialogueUI('suitorB', dialogueB);
        
        actionStatus.textContent = `第 ${roundCount} 回合... 裁判正在思考...`;

        const scores = await getJudgeEvaluation(dialogueA, dialogueB);

        updateScoresUI(scores);
        updateTotalScoreDisplay();

        if (roundCount >= MAX_ROUNDS) {
            actionStatus.textContent = `所有回合结束！点击查看最终审判！`;
            startRoundBtn.textContent = '🏆 查看最终审判 🏆';
        } else {
            actionStatus.textContent = `第 ${roundCount} 回合结束。准备好可以开始下一回合。`;
            startRoundBtn.textContent = `🎭 开始第 ${roundCount + 1} 回合`;
        }

    } catch (error) {
        console.error("Error during round:", error);
        actionStatus.textContent = `回合出错: ${error.message}`;
    } finally {
        startRoundBtn.disabled = false;
    }
}

/**
 * Generates dialogue for a suitor, considering the dynamic event.
 * @param {string} role - The suitor's role ('suitorA' or 'suitorB').
 * @param {string} dynamicEvent - The event that just occurred.
 * @returns {Promise<string>} The generated dialogue.
 */
async function getSuitorDialogue(role, dynamicEvent) {
    const suitor = characters[role];
    const otherSuitorRole = role === 'suitorA' ? 'suitorB' : 'suitorA';
    const otherSuitor = characters[otherSuitorRole];
    const judge = characters.judge;
    
    let history = "这是你们之前的对话历史：\n";
    for(let i=0; i<characters.suitorA.dialogue.length; i++){
        history += `${characters.suitorA.name}: ${characters.suitorA.dialogue[i]}\n`;
        history += `${characters.suitorB.name}: ${characters.suitorB.dialogue[i]}\n`;
    }
    if (characters.suitorA.dialogue.length === 0) {
        history = "这是你们对话的开始。";
    }

    const prompt = `
        你现在是 ${suitor.name}。
        你的角色设定是：\n${suitor.profile}\n
        你正在追求 ${judge.name}，TA的设定是：\n${judge.profile}\n
        你的情敌是 ${otherSuitor.name}，TA的设定是：\n${otherSuitor.profile}\n
        
        ${history}

        ---
        **重要突发事件:** 刚刚发生了这件事：“${dynamicEvent}”。
        ---

        现在轮到你发言了。请根据你的角色性格，巧妙地结合刚刚发生的【重要突发事件】，说一句能够打动 ${judge.name} 的话。
        你的发言要自然、有创意、符合人设，并且要考虑到情敌的存在和裁判的性格。
        直接输出你的台词，不要包含任何额外说明。
    `;

    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    return await callGeminiAPI(payload);
}

/**
 * Gets the judge's evaluation of the suitors' dialogues based on the event.
 * @param {string} dialogueA - Suitor A's dialogue.
 * @param {string} dialogueB - Suitor B's dialogue.
 * @returns {Promise<object>} An object containing scores and reasoning.
 */
async function getJudgeEvaluation(dialogueA, dialogueB) {
    const judge = characters.judge;
    
    const prompt = `
        你现在是 ${judge.name}。
        你的角色设定是：\n${judge.profile}\n

        刚刚发生了一个突发事件：“${currentEvent}”

        现在有两位追求者，A 和 B，在突发事件发生后，立刻向你示好。
        
        追求者 A (${characters.suitorA.name}) 说： "${dialogueA}"
        追求者 B (${characters.suitorB.name}) 说： "${dialogueB}"
        
        请根据你的角色性格和价值观，以及他们对刚才突发事件的反应，对这两位追求者刚才的表现进行评价。
        你需要为他们分别打分（1-10分），并给出你的打分理由。你的评价要犀利、符合人设，要评论他们是否巧妙地利用了刚才的事件。

        请严格按照以下JSON格式返回你的评价，不要添加任何其他文字说明：
        {
          "suitorA_score": <分数, 数字>,
          "suitorA_reasoning": "<对A的评价>",
          "suitorB_score": <分数, 数字>,
          "suitorB_reasoning": "<对B的评价>"
        }
    `;
    
    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
        }
    };
    const jsonString = await callGeminiAPI(payload);
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Failed to parse JSON from judge evaluation:", jsonString);
        return { suitorA_score: 5, suitorA_reasoning: "裁判的评价格式出错了，暂时给个友情分。", suitorB_score: 5, suitorB_reasoning: "裁判的评价格式出错了，暂时给个友情分。"};
    }
}

/**
 * --- NEW FUNCTION ---
 * Gets the inner monologue for a specific line of dialogue.
 * @param {HTMLElement} buttonElement - The button that was clicked.
 * @param {string} role - The role of the speaker.
 * @param {string} dialogueText - The text of the dialogue.
 */
async function getInnerMonologue(buttonElement, role, dialogueText) {
    buttonElement.disabled = true;
    buttonElement.textContent = '正在解读内心...';

    const suitor = characters[role];
    const otherSuitorRole = role === 'suitorA' ? 'suitorB' : 'suitorA';
    const otherSuitor = characters[otherSuitorRole];
    const judge = characters.judge;
    
    // Reconstruct history up to this point
    let history = "";
    let dialogueFound = false;
    for(let i=0; i<characters.suitorA.dialogue.length && !dialogueFound; i++){
        const dA = characters.suitorA.dialogue[i];
        const dB = characters.suitorB.dialogue[i];
        history += `${characters.suitorA.name}: ${dA}\n`;
        if (role === 'suitorA' && dA === dialogueText) { dialogueFound = true; break; }
        history += `${characters.suitorB.name}: ${dB}\n`;
        if (role === 'suitorB' && dB === dialogueText) { dialogueFound = true; break; }
    }
    if (history.length === 0) { history = "这是对话的开端。"; }

    const prompt = `
        你是一位顶级的心理分析师和编剧。请深入分析以下情境：

        **发言角色**: ${suitor.name}
        **角色设定**: ${suitor.profile}

        **追求目标**: ${judge.name} (设定: ${judge.profile})
        **竞争对手**: ${otherSuitor.name} (设定: ${otherSuitor.profile})

        **当时情境**: 刚刚发生了这件事： “${currentEvent}”
        **相关对话历史**: \n${history}
        **该角色刚说的话**: "${dialogueText}"

        **你的任务**:
        请以第一人称（"我当时想的是..."）来揭示 ${suitor.name} 在说出这句话时，内心深处的真实想法、策略或情感。
        分析要深刻、符合其人设。是什么动机让他这么说？他想达到什么效果？他如何看待裁判和情敌？
        请直接输出内心独白，文字要精炼、有力。
    `;
    
    try {
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
        const monologue = await callGeminiAPI(payload, false); // Don't show global status

        const monologueBubble = document.createElement('div');
        monologueBubble.className = 'monologue-bubble';
        monologueBubble.textContent = monologue;

        // Insert the monologue right after the button
        buttonElement.parentNode.appendChild(monologueBubble);
        buttonElement.textContent = '内心独白';
        buttonElement.style.display = 'none'; // Hide button after showing monologue
        
    } catch (error) {
        console.error("Error getting inner monologue:", error);
        const errorBubble = document.createElement('div');
        errorBubble.className = 'monologue-bubble';
        errorBubble.textContent = `解读内心失败: ${error.message}`;
        buttonElement.parentNode.appendChild(errorBubble);
        buttonElement.textContent = '解读失败';
        buttonElement.disabled = true;
    }
}


/**
 * Triggers the end of the game and generates the final verdict.
 */
async function endGame() {
    actionStatus.textContent = '游戏结束！正在生成最终审判...';
    startRoundBtn.disabled = true;

    const scoreA = characters.suitorA.totalScore;
    const scoreB = characters.suitorB.totalScore;

    let verdictContext;
    if (scoreA === scoreB) {
        verdictContext = `经过 ${MAX_ROUNDS} 回合的交流，两位追求者竟然打成了平手，分数都是 ${scoreA} 分！这让你陷入了艰难的抉择。`;
    } else {
        const winner = scoreA > scoreB ? characters.suitorA : characters.suitorB;
        verdictContext = `经过 ${MAX_ROUNDS} 回合的交流，${winner.name} 以 ${Math.max(scoreA, scoreB)} 分的成绩胜出。`;
    }

    const prompt = `
        你现在是 ${characters.judge.name}。你的角色设定是：\n${characters.judge.profile}\n
        ${verdictContext}
        
        两位追求者的最终得分如下：
        - ${characters.suitorA.name}: ${scoreA} 分
        - ${characters.suitorB.name}: ${scoreB} 分

        追求者 A (${characters.suitorA.name}) 的人设是：\n${characters.suitorA.profile}\n
        追求者 B (${characters.suitorB.name}) 的人设是：\n${characters.suitorB.profile}\n

        请根据你的性格、他们的总分以及整个过程中的表现，发表一段最终陈词。
        在陈词中，你需要：
        1. 宣布你最终的选择（或者在平局的情况下，你将如何决定）。
        2. 详细说明你做出这个选择的理由，结合他们的表现和你的价值观。
        3. 对另一方（或双方）说几句得体的话。
        你的陈词要感人、真诚、符合你的人设。直接输出你的最终陈词，不要包含任何额外说明。
    `;

    try {
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
        const finalVerdict = await callGeminiAPI(payload);
        displayFinalVerdict(finalVerdict);
    } catch (error) {
        console.error("Error generating final verdict:", error);
        actionStatus.textContent = `生成最终审判时出错: ${error.message}`;
    }
}


// --- UI Update Functions ---

/**
 * --- MODIFIED ---
 * Updates the dialogue UI for a specific character, adding the monologue button.
 * @param {string} role - The character's role.
 * @param {string} text - The dialogue text.
 */
function updateDialogueUI(role, text) {
    const dialogueContainer = document.getElementById(`dialogue-${role.replace('suitor', 'suitor')}`);
    
    const entryWrapper = document.createElement('div');
    entryWrapper.className = 'dialogue-entry mb-2';

    const bubble = document.createElement('div');
    bubble.classList.add('dialogue-bubble', 'suitor-bubble');
    bubble.textContent = text;
    
    const monologueButton = document.createElement('button');
    monologueButton.className = 'btn-monologue';
    monologueButton.textContent = '为什么这么说？';
    // Important: Use backticks for template literals and escape any backticks in the dialogue text itself.
    const escapedText = text.replace(/`/g, '\\`');
    monologueButton.setAttribute('onclick', `getInnerMonologue(this, '${role}', \`${escapedText}\`)`);

    entryWrapper.appendChild(bubble);
    entryWrapper.appendChild(monologueButton);
    dialogueContainer.appendChild(entryWrapper);
    dialogueContainer.scrollTop = dialogueContainer.scrollHeight;
}

/**
 * Updates the UI with the judge's scores for the current round.
 * @param {object} scores - The scores object from the API.
 */
function updateScoresUI(scores) {
    characters.suitorA.totalScore += scores.suitorA_score;
    characters.suitorB.totalScore += scores.suitorB_score;

    const scoresContainer = document.getElementById('scores');
    const scoreCard = document.createElement('div');
    scoreCard.classList.add('p-4', 'rounded-lg', 'shadow-md', 'score-card');
    
    scoreCard.innerHTML = `
        <div class="font-bold text-center text-pink-700 mb-3">第 ${roundCount} 回合评分</div>
        <div class="mb-3">
            <p class="font-semibold text-blue-600">对 ${characters.suitorA.name}: <span class="text-xl">${scores.suitorA_score}</span> / 10</p>
            <p class="text-sm text-gray-700 italic">"${scores.suitorA_reasoning}"</p>
        </div>
        <div>
            <p class="font-semibold text-green-600">对 ${characters.suitorB.name}: <span class="text-xl">${scores.suitorB_score}</span> / 10</p>
            <p class="text-sm text-gray-700 italic">"${scores.suitorB_reasoning}"</p>
        </div>
    `;
    
    scoresContainer.appendChild(scoreCard);
    scoresContainer.scrollTop = scoresContainer.scrollHeight;
}

/**
 * Updates the total score display and progress bars for both suitors.
 */
function updateTotalScoreDisplay() {
    const maxPossibleScore = MAX_ROUNDS * 10;
    
    const scoreBarA = document.getElementById('score-bar-suitorA');
    const totalScoreTextA = document.getElementById('total-score-suitorA');
    const percentageA = maxPossibleScore > 0 ? (characters.suitorA.totalScore / maxPossibleScore) * 100 : 0;
    scoreBarA.style.width = `${Math.min(percentageA, 100)}%`;
    totalScoreTextA.textContent = `总分: ${characters.suitorA.totalScore}`;

    const scoreBarB = document.getElementById('score-bar-suitorB');
    const totalScoreTextB = document.getElementById('total-score-suitorB');
    const percentageB = maxPossibleScore > 0 ? (characters.suitorB.totalScore / maxPossibleScore) * 100 : 0;
    scoreBarB.style.width = `${Math.min(percentageB, 100)}%`;
    totalScoreTextB.textContent = `总分: ${characters.suitorB.totalScore}`;
}

/**
 * Displays the final verdict in a modal.
 * @param {string} verdict - The final speech from the judge.
 */
function displayFinalVerdict(verdict) {
    const modal = document.getElementById('verdict-modal');
    const modalContent = document.getElementById('verdict-modal-content');
    const verdictText = document.getElementById('verdict-text');

    verdictText.textContent = verdict;
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        modalContent.classList.remove('scale-95', 'opacity-0');
        modalContent.classList.add('scale-100', 'opacity-100');
    }, 10);
}

/**
 * Closes the modal and reloads the page to start a new game.
 */
function closeVerdictModal() {
    window.location.reload();
}
