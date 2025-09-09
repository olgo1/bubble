document.addEventListener('DOMContentLoaded', () => {
    
    // --- Dynamic loading of the task module ---
    const params = new URLSearchParams(window.location.search);
    const topicName = params.get('topic');

    if (!topicName) {
        document.body.innerHTML = `
            <div style="text-align: center; padding: 40px; font-family: sans-serif;">
                <h1>Тренажёр готов к работе</h1>
                <p>Пожалуйста, укажите тему в адресной строке.</p>
                <p>Например: <strong>index.html?topic=имя_файла_с_заданиями</strong></p>
            </div>
        `;
        return;
    }

    const script = document.createElement('script');
    script.src = `${topicName}.js`;
    document.body.appendChild(script);

    script.onload = () => {
        initializeTrainer();
    };

    script.onerror = () => {
        document.body.innerHTML = `<h1 style="color: red; text-align: center;">ОШИБКА: Файл с задачами "${topicName}.js" не найден!</h1>`;
    };

    // --- Main trainer logic ---
    function initializeTrainer() {
        if (typeof trainerSettings === 'undefined' || typeof allTasks === 'undefined' || typeof isAnswerCorrect === 'undefined') {
            document.body.innerHTML = `<h1 style="color: red; text-align: center;">ОШИБКА: Файл "${topicName}.js" повреждён или имеет неверную структуру.</h1>`;
            return;
        }

        const $ = (sel) => document.querySelector(sel);
        const elements = {
            title: $('#trainer-title'),
            subtitle: $('#trainer-subtitle'),
            timer: $('#timer'),
            problemsContainer: $('#problems-container'),
            rerollBtn: $('#rerollBtn'),
            checkBtn: $('#checkBtn'),
            results: $('#results'),
            scoreText: $('#score-text'),
            printBtn: $('#printBtn'),
        };

        const state = {
            tasks: [],
            timerId: null,
            isFinished: false,
        };

        function formatTime(seconds) {
            const m = String(Math.floor(seconds / 60)).padStart(2, '0');
            const s = String(seconds % 60).padStart(2, '0');
            return `${m}:${s}`;
        }

        function startTimer() {
            if (state.timerId) clearInterval(state.timerId);
            state.isFinished = false;
            let timeLeft = trainerSettings.totalTime || 600;
            elements.timer.textContent = formatTime(timeLeft);
            state.timerId = setInterval(() => {
                if (state.isFinished) {
                    clearInterval(state.timerId);
                    return;
                }
                timeLeft--;
                elements.timer.textContent = formatTime(timeLeft);
                if (timeLeft <= 0) {
                    clearInterval(state.timerId);
                    checkAnswers();
                }
            }, 1000);
        }

        function pickTasks() {
            const tasksByType = allTasks.reduce((acc, task) => {
                if (!acc[task.type]) acc[task.type] = [];
                acc[task.type].push(task);
                return acc;
            }, {});
            const uniqueTypes = Object.keys(tasksByType);
            const shuffledTypes = uniqueTypes.sort(() => 0.5 - Math.random());
            const selectedTypes = shuffledTypes.slice(0, trainerSettings.problemsToSelect || 3);
            return selectedTypes.map(type => {
                const tasksInType = tasksByType[type];
                return tasksInType[Math.floor(Math.random() * tasksInType.length)];
            });
        }
        
        function createTaskCard(task) {
            const card = document.createElement('div');
            card.className = 'problem-card';
            const title = document.createElement('div');
            title.className = 'problem-title';
            const generatedTask = task.generate();
            title.innerHTML = generatedTask.problemText;
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'answer-input';
            const feedback = document.createElement('div');
            feedback.className = 'feedback';
            card.append(title, input, feedback);
            return { card, input, feedback, generatedTask, originalTask: task };
        }
        
        function render() {
            elements.title.textContent = trainerSettings.title || 'Тренажёр';
            elements.subtitle.textContent = trainerSettings.subtitle || '';
            elements.problemsContainer.innerHTML = '';
            elements.results.classList.add('hidden');
            elements.checkBtn.disabled = false;
            elements.rerollBtn.disabled = false;
            state.tasks = [];
            const pickedTasks = pickTasks();
            for (const task of pickedTasks) {
                const taskElements = createTaskCard(task);
                state.tasks.push(taskElements);
                elements.problemsContainer.appendChild(taskElements.card);
            }
            startTimer();
        }
        
        function checkAnswers() {
            if (state.isFinished) return;
            state.isFinished = true;
            elements.checkBtn.disabled = true;
            let correctCount = 0;
            for (const task of state.tasks) {
                const userAnswer = task.input.value.trim();
                const { correct, correctAnswerText } = isAnswerCorrect(userAnswer, task.originalTask, task.generatedTask.variables);
                if (correct) {
                    correctCount++;
                    task.feedback.textContent = 'Верно!';
                    task.feedback.className = 'feedback ok';
                } else {
                    task.feedback.className = 'feedback wrong';
                    task.feedback.innerHTML = `Неверно. <div class="details">Правильный ответ: ${correctAnswerText}</div>`;
                }
            }
            elements.results.classList.remove('hidden');
            elements.scoreText.textContent = `Результат: ${correctCount} из ${state.tasks.length}`;
        }

        function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // --- БЛОК ДЛЯ ПОДДЕРЖКИ КИРИЛЛИЦЫ (остаётся без изменений) ---
    const font = `...`; // Ваша длинная строка с закодированным шрифтом
    if (font.startsWith('PASTE')) {
        alert("Ошибка: Шрифт для PDF не встроен. Кириллилица не будет отображаться.");
        doc.setFont('Helvetica');
    } else {
        doc.addFileToVFS('PTSerif-Regular.ttf', font);
        doc.addFont('PTSerif-Regular.ttf', 'PT Serif', 'normal');
        doc.setFont('PT Serif');
    }
    // --- КОНЕЦ БЛОКА ---

    doc.setFontSize(18);
    doc.text(trainerSettings.title, 105, 20, { align: 'center' });
    
    let y = 40;
    state.tasks.forEach((task, index) => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = task.generatedTask.problemText;
        const questionText = tempDiv.innerText;

        const question = `${index + 1}. ${questionText}`;
        const { correctAnswerText } = isAnswerCorrect('', task.originalTask, task.generatedTask.variables);
        
        // --- НОВЫЙ КОД НАЧИНАЕТСЯ ЗДЕСЬ ---
        const userAnswerText = task.input.value.trim(); // Получаем ответ ученика
        const userAnswerLine = `Ответ ученика: ${userAnswerText || 'нет ответа'}`; // Формируем строку
        // --- НОВЫЙ КОД ЗАКАНЧИВАЕТСЯ ---
        
        const answer = `Правильный ответ: ${correctAnswerText}`;

        doc.setFontSize(12);
        const splitQuestion = doc.splitTextToSize(question, 180);
        doc.text(splitQuestion, 15, y);
        y += (splitQuestion.length * 5) + 5;

        // --- НОВЫЙ КОД НАЧИНАЕТСЯ ЗДЕСЬ ---
        doc.setTextColor(100, 100, 100); // Серый цвет для ответа ученика
        doc.text(userAnswerLine, 15, y);
        y += 7; // Увеличиваем отступ
        // --- НОВЫЙ КОД ЗАКАНЧИВАЕТСЯ ---

        doc.setTextColor(0, 100, 0); // Зелёный цвет для правильного ответа
        doc.text(answer, 15, y);
        y += 15;
        doc.setTextColor(0, 0, 0); // Сбрасываем цвет на чёрный
    });

    doc.save(`${trainerSettings.title.replace(/ /g, '_')}.pdf`);
}

        elements.checkBtn.addEventListener('click', checkAnswers);
        elements.rerollBtn.addEventListener('click', render);
        elements.printBtn.addEventListener('click', generatePDF);

        render();
    }
});
