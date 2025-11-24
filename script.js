document.addEventListener("DOMContentLoaded", () => {
    
    const domElements = {
        testList: document.getElementById("test-list"),
        filterInput: document.getElementById("filter-input"),
        homeView: document.getElementById("home-view"),
        detailView: document.getElementById("test-detail-view"),
        homeButton: document.getElementById("home-button"),
        flowContainer: document.getElementById("flowchart-container")
    };

    // --- ESTADO GLOBAL DA ANÁLISE ---
    let analysisState = {
        dfName: "meus_dados",
        columns: [], // Lista de nomes das colunas atuais
        selectedY: "", // Qual coluna é a Var Dependente
        selectedX: "", // Qual coluna é a Var Independente/Grupo
        isPivotMode: false, // Se o usuário ativou o modo pivot
        pivotCols: [] // Colunas para pivotar
    };

    let globalData = [];
    let currentTest = null; 

    // --- FUNÇÃO AUXILIAR: Normalizar Strings ---
    function normalizeStr(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }

    // --- 1. FLUXOS DE ANÁLISE GUIADA ---
    const analysisWorkflows = {
        "guide_2_indep": {
            title: "Comparação de 2 Grupos Independentes",
            description: "Antes de escolher o teste final, precisamos analisar a distribuição dos seus dados.",
            steps: [
                {
                    title: "1. Análise Descritiva Visual",
                    code: "library(ggplot2)\n# Boxplot para ver distribuição e outliers\nggplot({{df}}, aes(x = {{x}}, y = {{y}}, fill = {{x}})) + geom_boxplot() + theme_minimal()"
                },
                {
                    title: "2. Teste os Pressupostos (Normalidade e Variância)",
                    code: "# Normalidade (Shapiro-Wilk)\ntapply({{df}}${{y}}, {{df}}${{x}}, shapiro.test)\n\n# Homogeneidade (Levene)\nlibrary(car)\nleveneTest({{y}} ~ {{x}}, data = {{df}})"
                }
            ],
            question: "Observe os resultados acima (p-valor > 0.05 indica normalidade/homogeneidade). Seus dados seguem a distribuição Normal e possuem variâncias iguais?",
            buttons: [
                { text: "✅ Sim (Tudo Normal)", target: "Teste t de Student para Amostras Independentes (Não Pareado)" },
                { text: "❌ Não (Violou pressupostos)", target: "Teste de Mann-Whitney U" }
            ]
        },
        "guide_2_paired": {
            title: "Comparação de 2 Grupos Pareados",
            description: "Para testes pareados, o mais importante é a normalidade da DIFERENÇA entre os momentos.",
            steps: [
                {
                    title: "1. Calcular a Diferença",
                    code: "# Crie uma coluna de diferenças (exemplo genérico)\ndiferenca <- {{df}}$pos - {{df}}$pre\n\n# Visualize\nhist(diferenca, col='skyblue', main='Histograma das Diferenças')"
                },
                {
                    title: "2. Teste de Normalidade na Diferença",
                    code: "shapiro.test(diferenca)"
                }
            ],
            question: "O teste de Shapiro-Wilk na diferença deu p > 0.05 (Normal)?",
            buttons: [
                { text: "✅ Sim (Normal)", target: "Teste t Pareado" },
                { text: "❌ Não (Não Normal)", target: "Teste de Postos com Sinais de Wilcoxon (Wilcoxon Signed-Rank Test)" } 
            ]
        },
        "guide_3_indep": {
            title: "Comparação de 3+ Grupos Independentes",
            description: "Vamos verificar a normalidade dos resíduos e a homogeneidade das variâncias.",
            steps: [
                {
                    title: "1. Ajuste do Modelo e Pressupostos",
                    code: "modelo <- aov({{y}} ~ {{x}}, data = {{df}})\n\n# Normalidade dos resíduos\nshapiro.test(resid(modelo))\n\n# Homogeneidade (Levene)\nlibrary(car); leveneTest({{y}} ~ {{x}}, data = {{df}})"
                }
            ],
            question: "Os resíduos são normais E as variâncias homogêneas (ambos p > 0.05)?",
            buttons: [
                { text: "✅ Sim (Atende tudo)", target: "ANOVA de uma via (One-Way ANOVA)" },
                { text: "❌ Não (Falhou)", target: "Teste de Kruskal-Wallis" }
            ]
        },
        "guide_correlacao": {
            title: "Associação entre Variáveis Numéricas",
            description: "Para correlação, olhamos a normalidade de ambas as variáveis e a linearidade.",
            steps: [
                {
                    title: "1. Teste de Normalidade",
                    code: "shapiro.test({{df}}${{var1}})\nshapiro.test({{df}}${{var2}})"
                },
                {
                    title: "2. Visualizar Linearidade",
                    code: "plot({{df}}${{var1}}, {{df}}${{var2}}, main='Scatterplot')"
                }
            ],
            question: "As duas variáveis são normais e a relação parece linear?",
            buttons: [
                { text: "✅ Sim (Linear e Normal)", target: "Correlação de Pearson" },
                { text: "❌ Não (Monotônica/Não-Normal)", target: "Correlação de Spearman" }
            ]
        }
    };

    // --- 2. ÁRVORE DE DECISÃO ---
    const decisionTree = {
        start: {
            question: "Qual é o objetivo principal da sua análise?",
            options: [
                { text: "Comparar Médias/Grupos", next: "compare_groups" },
                { text: "Ver Associação/Correlação", next: "association" },
                { text: "Verificar Normalidade", next: "normality" }
            ]
        },
        compare_groups: {
            question: "Quantos grupos você quer comparar?",
            options: [
                { text: "2 Grupos", next: "two_groups" },
                { text: "3 ou mais Grupos", next: "three_groups" }
            ]
        },
        two_groups: {
            question: "Os grupos são independentes ou pareados?",
            options: [
                { text: "Independentes", workflow: "guide_2_indep" }, 
                { text: "Pareados (Mesmos sujeitos)", workflow: "guide_2_paired" } 
            ]
        },
        three_groups: {
            question: "Os grupos são independentes ou pareados?",
            options: [
                { text: "Independentes", workflow: "guide_3_indep" }, 
                { text: "Pareados (Medidas Repetidas)", result: "ANOVA de Medidas Repetidas" } 
            ]
        },
        association: {
            question: "Qual o tipo das suas variáveis?",
            options: [
                { text: "Numérica vs Numérica", workflow: "guide_correlacao" }, 
                { text: "Categórica vs Categórica", result: "Teste Qui-Quadrado de Independência" }
            ]
        },
        normality: {
            question: "Você quer testar se seus dados seguem uma Curva Normal?",
            options: [
                { text: "Sim", result: "Teste de Normalidade de Shapiro-Wilk" }
            ]
        }
    };

    function renderSidebarList(data) {
        domElements.testList.innerHTML = "";
        
        // Estilização da lista (Sem aspecto de card)
        domElements.testList.style.listStyle = "none";
        domElements.testList.style.padding = "0";
        domElements.testList.style.display = "flex";
        domElements.testList.style.flexDirection = "column";
        domElements.testList.style.gap = "2px"; 

        data.forEach(test => {
            const item = document.createElement("li"); 
            item.className = "test-item"; 
            item.dataset.title = test.titulo; 
            
            // Estilos inline para aparência limpa
            item.style.padding = "10px 12px";
            item.style.cursor = "pointer";
            item.style.borderRadius = "4px";
            item.style.color = "var(--text-muted, #aaa)";
            item.style.transition = "all 0.2s";
            item.style.borderLeft = "3px solid transparent";

            // Hover
            item.onmouseover = () => {
                if(!item.classList.contains('active')) {
                    item.style.backgroundColor = "rgba(255,255,255,0.05)";
                    item.style.color = "var(--text-main, #fff)";
                }
            };
            item.onmouseout = () => {
                if(!item.classList.contains('active')) {
                    item.style.backgroundColor = "transparent";
                    item.style.color = "var(--text-muted, #aaa)";
                }
            };

            item.innerText = test.titulo;

            item.addEventListener("click", () => selectTest(test.titulo, item));
            domElements.testList.appendChild(item);
        });
    }

    function selectTest(testTitle, clickedElement) {
        const target = normalizeStr(testTitle);
        currentTest = globalData.find(t => {
            const tTitle = normalizeStr(t.titulo);
            return tTitle.includes(target) || target.includes(tTitle);
        });
        
        if(!currentTest) {
            console.error("Teste não encontrado:", testTitle);
            currentTest = globalData.find(t => t.tags && t.tags.some(tag => target.includes(normalizeStr(tag))));
            
            if (!currentTest) {
                domElements.detailView.innerHTML = `<div style="padding:2rem; color:red;">Erro: Teste "${testTitle}" não encontrado.</div>`;
                switchView("detail");
                return;
            }
        }

        document.querySelectorAll(".test-item").forEach(item => {
            item.classList.remove("active");
            item.style.backgroundColor = "transparent";
            item.style.color = "var(--text-muted, #aaa)";
            item.style.borderLeft = "3px solid transparent";
            item.style.fontWeight = "normal";
            
            if(normalizeStr(item.dataset.title) === normalizeStr(currentTest.titulo)) {
                item.classList.add("active");
                item.style.backgroundColor = "rgba(100, 108, 255, 0.1)"; 
                item.style.color = "var(--primary, #646cff)"; 
                item.style.borderLeft = "3px solid var(--primary, #646cff)"; 
                item.style.fontWeight = "500";
            }
        });

        switchView("detail");
        renderFullDetailView(); 
    }

    // --- REFACTOR: MODO GUIADO ROBUSTO ---
    function renderGuidedMode(workflowKey) {
        const workflow = analysisWorkflows[workflowKey];
        if (!workflow) return;

        // 1. Prepara a View
        switchView("detail"); 
        domElements.detailView.innerHTML = "";
        
        // Reseta estado para garantir limpeza
        analysisState.selectedY = "";
        analysisState.selectedX = "";
        // Define um padrão genérico para pivot (já que ainda não sabemos o teste final)
        const defaultPivotConfig = { allowed: true, default_cols: 2 }; 

        // 2. Cabeçalho (Header)
        const header = document.createElement("div");
        header.className = "detail-header";
        header.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:2rem;">🕵️</span>
                <div>
                    <h1 style="margin:0; color: var(--accent-warning); font-size:1.8rem;">Análise Guiada: ${workflow.title}</h1>
                    <p class="description" style="margin-top:5px;">${workflow.description}</p>
                </div>
            </div>
        `;
        domElements.detailView.appendChild(header);

        // 3. Renderiza o Simulador de Dados (Reaproveitamento Total)
        // Precisamos simular um objeto "currentTest" fake para o simulador funcionar
        const mockTestContext = { pivot_config: defaultPivotConfig, formato_dados: { colunas: ["ID", "Grupo", "Valor"] } };
        
        createSectionTitle("1. Estrutura dos Dados (Configure aqui)");
        const accordion = document.createElement("div");
        accordion.className = "accordion-wrapper";
        const accHeader = document.createElement("div");
        accHeader.className = "accordion-header active"; 
        accHeader.innerHTML = `<h4>📊 Tabela de Dados (Edite os nomes e variáveis abaixo)</h4><span>▼</span>`;
        const accContent = document.createElement("div");
        accContent.className = "accordion-content open";
        
        // Hack temporário para renderEditableTable usar o config certo
        const oldCurrentTest = currentTest; // Salva o anterior
        currentTest = mockTestContext; // Injeta o contexto temporário
        
        renderDataSimulator(accContent); // Renderiza a tabela
        
        accordion.appendChild(accHeader);
        accordion.appendChild(accContent);
        domElements.detailView.appendChild(accordion);
        
        // Retorna o currentTest ao normal (null) para não quebrar outras coisas
        currentTest = null; 

        // 4. Importação
        createSectionTitle("2. Importação dos Dados");
        renderImportGuide(domElements.detailView);
        
        // 5. Seletores de Variáveis
        createSectionTitle("3. Defina as Variáveis para Diagnóstico");
        const selectorContainer = document.createElement("div");
        selectorContainer.id = "var-selector-container";
        domElements.detailView.appendChild(selectorContainer);
        
        // Força a renderização inicial dos seletores
        updateVariableSelectors();

        // 6. Bloco de Diagnóstico (Códigos de Pressupostos)
        createSectionTitle("4. Diagnóstico Estatístico (Rode no R)");
        const codeContainer = document.createElement("div");
        codeContainer.id = "dynamic-code-container"; // Usamos o mesmo ID para o updateAnalysisCode funcionar
        domElements.detailView.appendChild(codeContainer);

        // --- LÓGICA DE ATUALIZAÇÃO DE CÓDIGO ESPECÍFICA DO MODO GUIADO ---
        // Sobrescrevemos temporariamente a função global para este modo
        updateAnalysisCode = function() {
            const container = document.getElementById("dynamic-code-container");
            if (!container) return;
            container.innerHTML = "";

            // 1. Código de Pivot (se necessário)
            if (analysisState.isPivotMode) {
                const pivotCols = analysisState.pivotCols.map(c => `"${c}"`).join(", ");
                const dfLong = analysisState.dfName + "_longo";
                const pivotCode = `library(tidyr)\n\n# Transformando para formato longo\n${dfLong} <- ${analysisState.dfName} %>%\n  pivot_longer(cols = c(${pivotCols}), names_to = "Grupo", values_to = "Valor")`;
                renderBlock(container, "0. Preparação dos Dados", pivotCode);
            }

            const activeDF = analysisState.isPivotMode ? analysisState.dfName + "_longo" : analysisState.dfName;
            const varY = analysisState.selectedY || "[SELECIONE_VAR_Y]";
            const varX = analysisState.selectedX || "[SELECIONE_VAR_X]";

            // 2. Renderiza os passos do workflow (Data.json logic inside Script.js)
            workflow.steps.forEach(step => {
                let code = step.code;
                // Faz as substituições
                code = code.replace(/\{\{df\}\}/g, activeDF);
                code = code.replace(/\{\{y\}\}/g, varY);
                code = code.replace(/\{\{x\}\}/g, varX);
                code = code.replace(/\{\{var1\}\}/g, varY);
                code = code.replace(/\{\{var2\}\}/g, varX);
                
                renderBlock(container, step.title, code);
            });
        };

        // Atualiza o código inicial
        updateAnalysisCode();

        // 7. A Grande Pergunta (Decision Box)
        const decisionContainer = document.createElement("div");
        decisionContainer.style.marginTop = "3rem";
        decisionContainer.style.padding = "2rem";
        decisionContainer.style.border = "2px solid var(--primary)";
        decisionContainer.style.borderRadius = "12px";
        decisionContainer.style.backgroundColor = "rgba(138, 180, 248, 0.05)";
        decisionContainer.style.textAlign = "center";

        decisionContainer.innerHTML = `
            <h2 style="color:var(--text-main); margin-bottom:1rem;">🤔 Decisão Final</h2>
            <p style="font-size:1.1rem; color:var(--text-muted); margin-bottom:2rem;">
                ${workflow.question}
            </p>
            <div class="flow-options" id="guided-buttons">
                </div>
        `;

        domElements.detailView.appendChild(decisionContainer);

        const btnContainer = decisionContainer.querySelector("#guided-buttons");
        workflow.buttons.forEach(btn => {
            const button = document.createElement("button");
            button.className = "btn-flow";
            button.style.minWidth = "200px";
            button.textContent = btn.text;
            
            // Ação ao clicar: Volta a função original e carrega o teste
            button.onclick = () => {
                // Restaura a função original de update e chama o teste final
                selectTest(btn.target);
                // Scroll para o topo suavemente
                document.querySelector(".content-area").scrollTo({ top: 0, behavior: 'smooth' });
            };
            btnContainer.appendChild(button);
        });
    }

    function startFlowchart() {
        renderFlowStep("start");
    }

    function renderFlowStep(stepId) {
        const container = domElements.flowContainer;
        if (!container) return;
        container.innerHTML = ""; 
        const stepData = decisionTree[stepId];
        if (!stepData) return startFlowchart();

        const questionEl = document.createElement("h3");
        questionEl.className = "flow-question";
        questionEl.textContent = stepData.question;
        questionEl.style.opacity = "0"; 
        container.appendChild(questionEl);

        const optionsDiv = document.createElement("div");
        optionsDiv.className = "flow-options";

        stepData.options.forEach(opt => {
            const btn = document.createElement("button");
            btn.className = "btn-flow";
            btn.textContent = opt.text;
            
            btn.onclick = () => {
                if (opt.result) renderFlowResult(opt.result);
                else if (opt.workflow) renderGuidedMode(opt.workflow);
                else if (opt.next) renderFlowStep(opt.next);
            };
            optionsDiv.appendChild(btn);
        });
        container.appendChild(optionsDiv);
        
        if(stepId !== "start") {
            const resetBtn = document.createElement("button");
            resetBtn.className = "btn-reset";
            resetBtn.textContent = "Reiniciar";
            resetBtn.style.marginTop = "1rem";
            resetBtn.onclick = () => startFlowchart();
            container.appendChild(resetBtn);
        }
        requestAnimationFrame(() => { questionEl.style.transition = "opacity 0.5s"; questionEl.style.opacity = "1"; });
    }
    
    // --- RENDERIZAÇÃO DA VIEW DE DETALHES ---
    function renderFullDetailView() {
        if (!currentTest) return;

        // [FIX] Restaura a função original de gerar código, caso tenhamos vindo do Modo Guiado
        updateAnalysisCode = function() {
            const container = document.getElementById("dynamic-code-container");
            if (!container) return; 
            container.innerHTML = "";

            // Lógica Padrão (Pivot)
            if (analysisState.isPivotMode) {
                const pivotCols = analysisState.pivotCols.map(c => `"${c}"`).join(", ");
                const nameTo = document.getElementById("pivot-names-to")?.value || "Grupo";
                const valTo = document.getElementById("pivot-values-to")?.value || "Valor";
                const dfLong = analysisState.dfName + "_longo";
                const pivotCode = `library(tidyr)\n\n# Transformando dados largos para longos\n${dfLong} <- ${analysisState.dfName} %>%\n  pivot_longer(\n    cols = c(${pivotCols}),\n    names_to = "${nameTo}",\n    values_to = "${valTo}"\n  )\n\n# Use '${dfLong}' nas análises abaixo`;
                renderBlock(container, "0. Transformação dos Dados (Pivot)", pivotCode);
            }

            // Lógica Padrão (Testes do JSON)
            const activeDF = analysisState.isPivotMode ? analysisState.dfName + "_longo" : analysisState.dfName;
            const varY = analysisState.selectedY || "[SELECIONE_VAR_Y]";
            const varX = analysisState.selectedX || "[SELECIONE_VAR_X]";

            if (currentTest && currentTest.etapas_r) {
                currentTest.etapas_r.forEach(etapa => {
                    let code = etapa.codigo;
                    code = code.replace(/\{\{df\}\}/g, activeDF);
                    code = code.replace(/\{\{y\}\}/g, varY);
                    code = code.replace(/\{\{x\}\}/g, varX);
                    code = code.replace(/\{\{grupo\}\}/g, varX);
                    code = code.replace(/\{\{var1\}\}/g, varY);
                    code = code.replace(/\{\{var2\}\}/g, varX);
                    code = code.replace(/\bdados\b/g, activeDF); 

                    renderBlock(container, etapa.titulo, code);
                });
            }
        };

        domElements.detailView.innerHTML = "";

        analysisState.columns = [];
        // NOTA: Removemos o reset de selectedY e selectedX aqui para preservar as escolhas do modo guiado
        // analysisState.selectedY = "";
        // analysisState.selectedX = "";
        
        // Se viemos diretamente da home, talvez precisemos resetar, mas se viemos do guiado, queremos manter.
        // Solução: Só reseta se estiver vazio ou se o usuário estiver trocando drasticamente de contexto.
        // Por segurança para a demo, vamos comentar o reset forçado.
        if (!analysisState.dfName) analysisState.dfName = "meus_dados";
        analysisState.isPivotMode = false;
        analysisState.pivotCols = [];

        const headerDiv = document.createElement("div");
        headerDiv.className = "detail-header";
        headerDiv.innerHTML = `<h1>${currentTest.titulo}</h1><p>${currentTest.descricao}</p>`;
        domElements.detailView.appendChild(headerDiv);

        // --- NOVO: Inserir Gráfico Conceitual ---
        const visualArt = renderConceptChart(currentTest.titulo);
        if(visualArt) {
            domElements.detailView.appendChild(visualArt);
        }
        
        createSectionTitle("Hipóteses");
        const gridDiv = document.createElement("div");
        gridDiv.className = "hypothesis-grid";
        gridDiv.innerHTML = `
            <div class="h-card h0">
                <div class="visual-hypothesis h0">
                    <div class="bell-curve c1"></div>
                    <div class="bell-curve c2"></div>
                </div>
                <h4>H0 (Nula)</h4>
                <p>${currentTest.hipoteses.nula}</p>
            </div>
            <div class="h-card h1">
                <div class="visual-hypothesis h1">
                    <div class="bell-curve c1"></div>
                    <div class="bell-curve c2"></div>
                </div>
                <h4>H1 (Alternativa)</h4>
                <p>${currentTest.hipoteses.alternativa}</p>
            </div>`;
        domElements.detailView.appendChild(gridDiv);

        // 3. Simulador
        createSectionTitle("1. Estrutura dos Dados (Edite para configurar)");
        const accordion = document.createElement("div");
        accordion.className = "accordion-wrapper";
        const accHeader = document.createElement("div");
        accHeader.className = "accordion-header active"; 
        accHeader.innerHTML = `<h4>📊 Tabela de Exemplo (Edite os nomes e variáveis abaixo)</h4><span>▼</span>`;
        const accContent = document.createElement("div");
        accContent.className = "accordion-content open";
        accHeader.onclick = () => {
            accHeader.classList.toggle("active");
            accContent.classList.toggle("open");
        };
        renderDataSimulator(accContent); 
        accordion.appendChild(accHeader);
        accordion.appendChild(accContent);
        domElements.detailView.appendChild(accordion);

        // 4. Importação
        createSectionTitle("2. Importação dos Dados (Copie o código)");
        renderImportGuide(domElements.detailView);

        // 5. Seleção Variáveis
        createSectionTitle("3. Defina as Variáveis da Análise");
        const selectorContainer = document.createElement("div");
        selectorContainer.id = "var-selector-container";
        domElements.detailView.appendChild(selectorContainer);

        // --- 6. PRESSUPOSTOS (CARDS PEQUENOS) ---
        createSectionTitle("4. Pressupostos (Regras do Teste)");
        
        const assumptionsDiv = document.createElement("div");
        assumptionsDiv.className = "assumptions-grid";
        
        // Configuração CSS Grid Inline para os cards
        assumptionsDiv.style.display = "grid";
        assumptionsDiv.style.gridTemplateColumns = "repeat(auto-fill, minmax(220px, 1fr))";
        assumptionsDiv.style.gap = "12px";
        assumptionsDiv.style.marginTop = "10px";

        if (currentTest.pressupostos) {
            currentTest.pressupostos.forEach(p => {
                const card = document.createElement("div");
                
                // Estilização do Mini Card
                card.style.backgroundColor = "var(--bg-secondary, #2a2a2e)";
                card.style.padding = "12px";
                card.style.borderRadius = "8px";
                card.style.border = "1px solid var(--border, #3e3e42)";
                card.style.borderLeft = "4px solid var(--primary, #646cff)";
                card.style.display = "flex";
                card.style.flexDirection = "column";
                card.style.gap = "4px";

                // Renderização Condicional (Objeto vs String)
                if (typeof p === 'object') {
                    card.innerHTML = `
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                            <span style="font-size:1.4rem;">${p.icone || '📌'}</span>
                            <strong style="color:var(--text-main, #fff); font-size:0.95rem;">${p.nome}</strong>
                        </div>
                        <p style="margin:0; font-size:0.85rem; color:var(--text-muted, #ccc); line-height:1.4;">${p.descricao}</p>
                        ${p.violacao ? `<div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1); font-size:0.75rem; color:var(--accent-danger, #ff6b6b);"><em>⚠️ ${p.violacao}</em></div>` : ''}
                    `;
                } else {
                    // Fallback para formato antigo (string)
                    card.innerHTML = `<div style="display:flex; align-items:center; gap:8px;"><span style="color:var(--primary)">•</span> <span style="color:#ccc; font-size:0.9rem;">${p}</span></div>`;
                }
                assumptionsDiv.appendChild(card);
            });
        } else {
            assumptionsDiv.innerHTML = "<p style='color:#666; font-style:italic'>Nenhum pressuposto específico listado.</p>";
        }
        domElements.detailView.appendChild(assumptionsDiv);

        // 7. Códigos R
        createSectionTitle("5. Códigos R Gerados");
        const codeDiv = document.createElement("div");
        codeDiv.id = "dynamic-code-container";
        domElements.detailView.appendChild(codeDiv);
        updateAnalysisCode();

        // --- NOVO BLOCO: Exemplo de Saída do R ---
        if (currentTest.saida_exemplo) {
            createSectionTitle("6. Entendendo a Saída do R (Output)");
            
            const outputContainer = document.createElement("div");
            outputContainer.className = "code-block"; // Reutilizando estilo de código
            outputContainer.style.borderColor = "var(--primary)";
            
            // Renderiza o texto cru do output
            let highlightsHTML = "";
            if(currentTest.saida_exemplo.destaques) {
                highlightsHTML = currentTest.saida_exemplo.destaques.map(d => 
                    `<li style="margin-bottom:0.5rem">
                        <strong style="color:var(--accent-warning)">${d.termo}:</strong> 
                        <span style="color:var(--text-muted)">${d.significado}</span>
                    </li>`
                ).join("");
            }

            outputContainer.innerHTML = `
                <div class="code-header" style="background:rgba(138, 180, 248, 0.1); color:var(--primary)">
                    Exemplo Típico no Console
                </div>
                <div style="padding:1.5rem; display:flex; flex-direction:column; gap:1rem;">
                    <code style="color:#d4d4d4; font-family:'Fira Code'; display:block; padding-bottom:1rem; border-bottom:1px solid #333;">
                        ${currentTest.saida_exemplo.texto}
                    </code>
                    <ul style="margin:0; padding-left:1.2rem; list-style:none;">
                        ${highlightsHTML}
                    </ul>
                </div>
            `;
            domElements.detailView.appendChild(outputContainer);
        }
        
        // 8. Report
        createSectionTitle("Como Reportar");
        const rep = document.createElement("div"); rep.className = "report-box"; rep.textContent = currentTest.report;
        domElements.detailView.appendChild(rep);

        // --- 7. INTERPRETADOR VISUAL (ATUALIZADO & FINAL) ---
        createSectionTitle("7. Interpretador de Resultados (Interativo)");
        
        const wizardDiv = document.createElement("div");
        wizardDiv.className = "p-value-gauge-container";
        
        wizardDiv.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                <h4 style="margin:0; color:var(--text-main)">🎯 Termômetro de Decisão (P-Valor)</h4>
                <input type="number" id="p-input" step="0.001" placeholder="Ex: 0.03" 
                       style="padding:0.5rem; border-radius:4px; border:1px solid #555; background:#111; color:var(--accent-warning); width:100px; font-size:1.1rem; font-weight:bold;">
            </div>
            
            <div class="gauge-track">
                <div class="gauge-success-zone"></div> <div class="gauge-marker-line"></div>
                <div class="gauge-marker-text">0.05</div>
                <div class="gauge-needle-new" id="gauge-needle"></div>
            </div>
            
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#666; margin-bottom:1.5rem;">
                <span>0.00 (Diferença Clara)</span>
                <span style="text-align:right;">1.00 (Igualdade Total)</span>
            </div>

            <div id="p-conclusion" style="background:rgba(0,0,0,0.2); padding:1rem; border-radius:8px; text-align:center;">
                <span style="color:var(--text-muted)">Digite o valor p acima para ver o diagnóstico.</span>
            </div>
        `;

        domElements.detailView.appendChild(wizardDiv);

        // Lógica do Termômetro
        const inputP = wizardDiv.querySelector("#p-input");
        const conclusion = wizardDiv.querySelector("#p-conclusion");
        const needle = wizardDiv.querySelector("#gauge-needle");

        inputP.addEventListener("input", (e) => {
            let p = parseFloat(e.target.value);
            
            if(isNaN(p)) {
                 needle.style.opacity = "0";
                 conclusion.innerHTML = '<span style="color:var(--text-muted)">Aguardando número...</span>';
                 return;
            }
            
            needle.style.opacity = "1";
            if(p < 0) p = 0;
            if(p > 1) p = 1;

            // Escala Visual Híbrida:
            // Queremos que o 0.05 fique visível, não esmagado no canto.
            // Vamos fazer o 0.05 ficar em 10% da largura da barra para dar espaço visual.
            let visualLeft = 0;
            if(p <= 0.05) {
                // Mapeia 0-0.05 para 0-5% (para coincidir com o marcador CSS)
                visualLeft = (p / 0.05) * 5; 
            } else {
                // Mapeia 0.05-1.0 para 5%-100%
                visualLeft = 5 + ((p - 0.05) / (1 - 0.05)) * 95;
            }
            
            needle.style.left = `${visualLeft}%`;
            needle.style.backgroundColor = p < 0.05 ? "#81c995" : "#f28b82"; // Verde ou Vermelho

            if(p < 0.05) {
                conclusion.innerHTML = `
                    <div style="font-size:1.2rem; margin-bottom:0.5rem">✨ <strong style="color:var(--accent-success)">RESULTADO SIGNIFICATIVO</strong></div>
                    <div style="font-size:0.9rem; color:#ddd">A probabilidade desse resultado ser sorte é muito baixa (${(p*100).toFixed(2)}%).<br>Você deve <strong>Rejeitar a Hipótese Nula</strong>.</div>
                `;
                conclusion.style.border = "1px solid var(--accent-success)";
            } else {
                conclusion.innerHTML = `
                    <div style="font-size:1.2rem; margin-bottom:0.5rem">🤷 <strong style="color:var(--accent-danger)">NÃO SIGNIFICATIVO</strong></div>
                    <div style="font-size:0.9rem; color:#ddd">Não há provas suficientes de diferença. Pode ser apenas variação natural.<br>Você deve <strong>Aceitar a Hipótese Nula</strong>.</div>
                `;
                conclusion.style.border = "1px solid var(--accent-danger)";
            }
        });
    }

    // --- FUNÇÃO: IMPORTAÇÃO DE ARQUIVOS ---
    function renderImportGuide(container) {
        const importWrapper = document.createElement("div");
        importWrapper.className = "import-guide-box";
        
        importWrapper.innerHTML = `
            <div class="import-header">
                <h4>📂 Como ler seu arquivo no R?</h4>
                <p style="font-size:0.85rem; color:var(--text-muted)">Escolha o formato do seu arquivo para ver o código correto (ajustado para o padrão brasileiro).</p>
            </div>
            <div class="import-tabs">
                <button class="tab-btn active" data-type="excel">Excel (.xlsx)</button>
                <button class="tab-btn" data-type="csv">CSV (.csv)</button>
                <button class="tab-btn" data-type="txt">Texto (.txt)</button>
            </div>
            <div class="import-code-area">
            </div>
        `;

        container.appendChild(importWrapper);

        const tabs = importWrapper.querySelectorAll(".tab-btn");
        const codeArea = importWrapper.querySelector(".import-code-area");

        const getImportCodes = () => ({
            excel: {
                title: "Ler arquivo Excel (.xlsx)",
                code: `# Instale o pacote se ainda não tiver
if(!require(readxl)) install.packages("readxl")
library(readxl)

# A função file.choose() abre uma janela para você selecionar o arquivo
${analysisState.dfName} <- read_excel(file.choose())

# Visualizar as primeiras linhas
head(${analysisState.dfName})`
            },
            csv: {
                title: "Ler arquivo CSV (Padrão Brasileiro)",
                description: "Use se seu Excel salva CSV com ponto-e-vírgula (;) e decimais com vírgula.",
                code: `# read.csv2 já vem configurado para o padrão Brasil (sep=";", dec=",")
# A função file.choose() abre uma janela para selecionar
${analysisState.dfName} <- read.csv2(file.choose(), stringsAsFactors = TRUE)

# Se der erro, tente forçar o encoding (comum no Windows):
# ${analysisState.dfName} <- read.csv2(file.choose(), fileEncoding = "latin1")`
            },
            txt: {
                title: "Ler arquivo de Texto (.txt)",
                description: "Geralmente separado por Tabulação (Tab) ou Espaços.",
                code: `# Se separado por TABULAÇÃO (o mais comum):
${analysisState.dfName} <- read.delim(file.choose(), dec = ",") 
# Note o argumento dec = "," para ler decimais brasileiros corretamente

# Se separado por ESPAÇOS em branco:
# ${analysisState.dfName} <- read.table(file.choose(), header = TRUE, dec = ",")`
            }
        });

        function showImportCode(type) {
            const codes = getImportCodes();
            const data = codes[type];
            
            codeArea.innerHTML = `
                <div class="code-block" style="margin-bottom:0">
                    <div class="code-header">
                        ${data.title} 
                        ${data.description ? `<span style="font-weight:normal; opacity:0.7"> - ${data.description}</span>` : ''}
                    </div>
                    <pre><code>${data.code}</code></pre>
                    <button class="copy-btn">Copiar</button>
                </div>
            `;
            
            const copyBtn = codeArea.querySelector(".copy-btn");
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(data.code);
                copyBtn.innerText = "Copiado!";
                setTimeout(() => copyBtn.innerText = "Copiar", 2000);
            };
        }

        tabs.forEach(btn => {
            btn.addEventListener("click", () => {
                tabs.forEach(t => t.classList.remove("active"));
                btn.classList.add("active");
                importWrapper.dataset.activeType = btn.dataset.type;
                showImportCode(btn.dataset.type);
            });
        });

        importWrapper.dataset.activeType = "excel";
        showImportCode("excel");
    }

    // --- FUNÇÃO CORE: SIMULADOR DE DADOS ---
    function renderDataSimulator(container) {
        const wrapper = document.createElement("div");
        wrapper.className = "simulator-container";

        const dfInputGroup = document.createElement("div");
        dfInputGroup.style.marginBottom = "1rem";
        dfInputGroup.innerHTML = `
            <label style="color:var(--text-muted); font-size:0.85rem">Nome da sua Tabela no R:</label>
            <input type="text" value="${analysisState.dfName}" id="df-name-input" 
            style="background:#333; border:1px solid #444; color:white; padding:0.5rem; border-radius:4px; margin-left:0.5rem;">
        `;
        dfInputGroup.querySelector("input").addEventListener("input", (e) => {
            analysisState.dfName = e.target.value || "meus_dados";
            updateAnalysisCode();
            const importBox = document.querySelector(".import-guide-box");
            if (importBox) {
                const activeType = importBox.dataset.activeType || "excel";
                const activeTab = importBox.querySelector(`.tab-btn[data-type="${activeType}"]`);
                if(activeTab) activeTab.click();
            }
        });
        wrapper.appendChild(dfInputGroup);

        const formato = currentTest ? currentTest.formato_dados : null;
        const pivotConfig = currentTest && currentTest.pivot_config ? currentTest.pivot_config : { allowed: false, default_cols: 0 };

        if(!formato || !formato.colunas) {
            wrapper.innerHTML += "<p style='color:#aaa'>Definição de colunas padrão não disponível.</p>";
            container.appendChild(wrapper);
            return;
        }

        const tableContainer = document.createElement("div");
        
        if (pivotConfig.allowed) {
            const pivotWrapper = document.createElement("div");
            pivotWrapper.className = "pivot-toggle-wrapper";
            pivotWrapper.style.cssText = "background:rgba(255,255,255,0.05); padding:0.8rem; border-radius:6px; margin-bottom:1rem; display:flex; align-items:center; gap:10px;";
            pivotWrapper.innerHTML = `
                <input type="checkbox" id="pivot-check" style="transform:scale(1.5)">
                <div>
                    <strong style="color:var(--accent-warning); display:block;">Meus dados estão separados em colunas? (Formato Largo)</strong>
                    <span style="font-size:0.8rem; color:var(--text-muted)">Ative para gerar código de transformação (Pivot).</span>
                </div>
            `;
            wrapper.appendChild(pivotWrapper);

            const pivotCheck = pivotWrapper.querySelector("#pivot-check");
            analysisState.pivotCols = Array.from({length: pivotConfig.default_cols}, (_, i) => `Grupo_${String.fromCharCode(65+i)}`);

            pivotCheck.addEventListener("change", (e) => {
                analysisState.isPivotMode = e.target.checked;
                renderEditableTable(tableContainer, formato, analysisState.isPivotMode);
            });
        } else {
            analysisState.isPivotMode = false;
        }

        wrapper.appendChild(tableContainer);
        renderEditableTable(tableContainer, formato, false);
        container.appendChild(wrapper);
    }

    // --- RENDERIZAR TABELA EDITÁVEL ---
    function renderEditableTable(container, formato, isPivot) {
        container.innerHTML = "";
        
        const table = document.createElement("table");
        table.className = "editable-table";
        const thead = document.createElement("thead");
        const tbody = document.createElement("tbody");
        const trHead = document.createElement("tr");

        let displayCols = [];
        let displayRows = [];

        if (isPivot) {
            displayCols = ["ID", ...analysisState.pivotCols];
            displayRows = [
                ["1", ...analysisState.pivotCols.map(() => (Math.random()*10 + 10).toFixed(1))],
                ["2", ...analysisState.pivotCols.map(() => (Math.random()*10 + 10).toFixed(1))]
            ];
        } else {
            displayCols = [...formato.colunas];
            displayRows = formato.exemplo || [];
        }

        analysisState.columns = [];

        displayCols.forEach((colName, index) => {
            const th = document.createElement("th");
            const input = document.createElement("input");
            input.type = "text";
            input.className = "header-input";
            input.value = colName;
            input.style.cssText = "width:100%; background:transparent; border:none; color:var(--text-main); font-weight:bold; text-align:center;";
            
            if (isPivot && index > 0) { 
                input.addEventListener("keyup", (e) => {
                    analysisState.pivotCols[index-1] = e.target.value;
                    updateAnalysisCode();
                });
            } else if (!isPivot) {
                 analysisState.columns.push(colName);
                 input.addEventListener("keyup", (e) => {
                    analysisState.columns[index] = e.target.value;
                    updateVariableSelectors();
                 });
            }

            th.appendChild(input);
            trHead.appendChild(th);
        });
        
        thead.appendChild(trHead);
        
        displayRows.forEach(row => {
            const tr = document.createElement("tr");
            row.forEach(cellData => {
                const td = document.createElement("td");
                td.innerText = cellData;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        container.appendChild(table);

        if (isPivot) {
            const toolsDiv = document.createElement("div");
            toolsDiv.style.cssText = "display:flex; gap:10px; margin-top:0.5rem; justify-content:flex-end;";
            
            const btnAdd = document.createElement("button");
            btnAdd.innerText = "+ Adicionar Grupo";
            btnAdd.className = "copy-btn";
            btnAdd.style.position = "static";
            
            const btnRem = document.createElement("button");
            btnRem.innerText = "- Remover";
            btnRem.className = "copy-btn";
            btnRem.style.position = "static";

            btnAdd.onclick = () => {
                const newColName = `Grupo_${String.fromCharCode(65 + analysisState.pivotCols.length)}`;
                analysisState.pivotCols.push(newColName);
                renderEditableTable(container, formato, true);
                updateAnalysisCode();
            };

            btnRem.onclick = () => {
                if(analysisState.pivotCols.length > 2) {
                    analysisState.pivotCols.pop();
                    renderEditableTable(container, formato, true);
                    updateAnalysisCode();
                } else {
                    alert("Mínimo de 2 grupos necessário para pivotar.");
                }
            };

            toolsDiv.appendChild(btnRem);
            toolsDiv.appendChild(btnAdd);
            container.appendChild(toolsDiv);

            const extraConfig = document.createElement("div");
            extraConfig.style.cssText = "margin-top:1rem; padding:1rem; background:#252629; border-radius:8px; border:1px solid var(--border);";
            extraConfig.innerHTML = `
                <h5 style="margin:0 0 1rem 0; color:var(--primary)">Configuração da Transformação:</h5>
                <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                    <div style="flex:1">
                        <label style="font-size:0.8rem; display:block; margin-bottom:0.3rem">Nome da nova coluna de GRUPOS:</label>
                        <input type="text" id="pivot-names-to" value="Grupo" style="width:100%; padding:0.5rem; background:#333; border:1px solid #555; color:white;">
                    </div>
                    <div style="flex:1">
                        <label style="font-size:0.8rem; display:block; margin-bottom:0.3rem">Nome da nova coluna de VALORES:</label>
                        <input type="text" id="pivot-values-to" value="Valor" style="width:100%; padding:0.5rem; background:#333; border:1px solid #555; color:white;">
                    </div>
                </div>
            `;
            container.appendChild(extraConfig);

            const nTo = extraConfig.querySelector("#pivot-names-to");
            const vTo = extraConfig.querySelector("#pivot-values-to");
            
            const updatePivotVars = () => {
                analysisState.columns = [nTo.value, vTo.value]; 
                updateVariableSelectors();
                updateAnalysisCode();
            };

            nTo.addEventListener("keyup", updatePivotVars);
            vTo.addEventListener("keyup", updatePivotVars);
            
            updatePivotVars(); 
        } else {
            updateVariableSelectors(); 
        }
    }

    // --- ATUALIZA BOTÕES DE SELEÇÃO (CHIPS) ---
    function updateVariableSelectors() {
        const container = document.getElementById("var-selector-container");
        if (!container) return;
        container.innerHTML = "";

        const isAssociation = currentTest && currentTest.titulo.toLowerCase().includes("qui-quadrado");
        
        const labelY = isAssociation ? "Variável 1 (Linhas)" : "Variável Resposta (Numérica / Y)";
        const labelX = isAssociation ? "Variável 2 (Colunas)" : "Variável de Grupo / Independente (X)";

        createSelectorArea(container, "y", labelY, analysisState.columns);
        createSelectorArea(container, "x", labelX, analysisState.columns);
        
        updateAnalysisCode();
    }

    function createSelectorArea(parent, type, labelText, options) {
        const group = document.createElement("div");
        group.className = "var-selector-group";
        
        const label = document.createElement("span");
        label.className = "var-selector-label";
        label.innerText = labelText;
        group.appendChild(label);

        const chipsDiv = document.createElement("div");
        chipsDiv.className = "chips-container";

        options.forEach(opt => {
            if(opt.toLowerCase() === "id") return;

            const chip = document.createElement("button");
            chip.className = "var-chip";
            chip.innerText = opt;
            
            const currentSelection = type === 'y' ? analysisState.selectedY : analysisState.selectedX;
            if (currentSelection === opt) chip.classList.add("selected");

            chip.onclick = () => {
                if (type === 'y') analysisState.selectedY = opt;
                else analysisState.selectedX = opt;
                
                Array.from(chipsDiv.children).forEach(c => c.classList.remove("selected"));
                chip.classList.add("selected");

                updateAnalysisCode();
            };
            chipsDiv.appendChild(chip);
        });

        group.appendChild(chipsDiv);
        parent.appendChild(group);
    }

    // --- GERADOR DE CÓDIGO FINAL (GLOBAL INICIAL) ---
    // Esta função será sobrescrita dentro de renderFullDetailView e renderGuidedMode
    function updateAnalysisCode() {
        const container = document.getElementById("dynamic-code-container");
        if (!container) return; 
        container.innerHTML = "";

        if (analysisState.isPivotMode) {
            const pivotCols = analysisState.pivotCols.map(c => `"${c}"`).join(", ");
            const nameTo = document.getElementById("pivot-names-to")?.value || "Grupo";
            const valTo = document.getElementById("pivot-values-to")?.value || "Valor";
            const dfLong = analysisState.dfName + "_longo";

            const pivotCode = `library(tidyr)\n\n# Transformando dados largos para longos\n${dfLong} <- ${analysisState.dfName} %>%\n  pivot_longer(\n    cols = c(${pivotCols}),\n    names_to = "${nameTo}",\n    values_to = "${valTo}"\n  )\n\n# Use '${dfLong}' nas análises abaixo`;
            
            renderBlock(container, "0. Transformação dos Dados (Pivot)", pivotCode);
        }

        const activeDF = analysisState.isPivotMode ? analysisState.dfName + "_longo" : analysisState.dfName;
        const varY = analysisState.selectedY || "[SELECIONE_VAR_Y]";
        const varX = analysisState.selectedX || "[SELECIONE_VAR_X]";

        if (currentTest && currentTest.etapas_r) {
            currentTest.etapas_r.forEach(etapa => {
                let code = etapa.codigo;
                code = code.replace(/\{\{df\}\}/g, activeDF);
                code = code.replace(/\{\{y\}\}/g, varY);
                code = code.replace(/\{\{x\}\}/g, varX);
                code = code.replace(/\{\{grupo\}\}/g, varX);
                code = code.replace(/\{\{var1\}\}/g, varY);
                code = code.replace(/\{\{var2\}\}/g, varX);
                code = code.replace(/\bdados\b/g, activeDF); 

                renderBlock(container, etapa.titulo, code);
            });
        }
    }

    function renderBlock(container, title, content) {
        const block = document.createElement("div");
        block.className = "code-block";
        block.innerHTML = `<div class="code-header">${title}</div>`;
        const pre = document.createElement("pre");
        pre.innerHTML = `<code>${content}</code>`;
        
        const btn = document.createElement("button");
        btn.className = "copy-btn";
        btn.innerText = "Copiar";
        btn.onclick = () => { navigator.clipboard.writeText(content); btn.innerText="Copiado!"; setTimeout(()=>btn.innerText="Copiar",2000); };
        
        block.appendChild(btn);
        block.appendChild(pre);
        container.appendChild(block);
    }

    function createSectionTitle(text) {
        const div = document.createElement("div"); div.className = "section-title"; div.textContent = text;
        domElements.detailView.appendChild(div);
    }

    function renderFlowResult(testTitle) {
        const container = domElements.flowContainer;
        
        // 1. Tenta encontrar o teste na base de dados global
        const targetTest = globalData.find(t => 
            normalizeStr(t.titulo).includes(normalizeStr(testTitle)) || 
            normalizeStr(testTitle).includes(normalizeStr(t.titulo))
        );

        // 2. Define o conteúdo com base na existência do teste
        let htmlContent = "";

        if (targetTest) {
            // Cenário A: O teste existe
            htmlContent = `
                <div class="flow-result-box">
                    <h2 class="flow-result-title">Sugestão Final:</h2>
                    <h3 style="margin-bottom: 1.5rem; color: var(--text-main);">${targetTest.titulo}</h3>
                    <p style="color:var(--text-muted); margin-bottom: 2rem; font-size: 0.9rem;">${targetTest.descricao.substring(0, 100)}...</p>
                    <button class="btn-action" id="btn-go">Ver Tutorial Completo →</button>
                </div>
            `;
        } else {
            // Cenário B: O teste ainda não foi implementado (Em Construção)
            htmlContent = `
                <div class="flow-result-box" style="border-color: var(--text-muted);">
                    <h2 class="flow-result-title" style="color: var(--accent-warning);">🚧 Em Construção</h2>
                    <h3 style="margin-bottom: 1rem;">${testTitle}</h3>
                    <p style="color:#aaa;">Este teste ainda não foi cadastrado na nossa base de dados.</p>
                    <button class="btn-action" style="background: #333; color: #aaa; cursor: not-allowed;">Indisponível</button>
                </div>
            `;
        }

        // Adiciona botão de reiniciar
        htmlContent += `<button class="btn-reset" id="btn-restart" style="display:block; margin:2rem auto">Reiniciar Fluxo</button>`;
        
        container.innerHTML = htmlContent;

        // 3. Adiciona os eventos
        if (targetTest) {
            document.getElementById("btn-go").onclick = () => selectTest(targetTest.titulo);
        }
        document.getElementById("btn-restart").onclick = () => startFlowchart();
    }

    function switchView(view) {
        if(view === "home") { domElements.homeView.classList.remove("hidden"); domElements.detailView.classList.add("hidden"); }
        else { domElements.homeView.classList.add("hidden"); domElements.detailView.classList.remove("hidden"); }
        document.querySelector(".content-area").scrollTop = 0;
    }

    // Configura listeners globais (Busca, Botão Home)
    function setupEventListeners() {
        domElements.homeButton.addEventListener("click", () => {
            switchView("home");
            startFlowchart(); // Reseta o fluxo ao voltar pra home
        });

        domElements.filterInput.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase();
            const items = document.querySelectorAll(".test-item");
            items.forEach(item => {
                const text = item.innerText.toLowerCase();
                item.style.display = text.includes(term) ? "block" : "none";
            });
        });
    }

    // --- FUNÇÃO AUXILIAR: Gerar Gráficos SVG Profissionais ---
    function renderConceptChart(testTitle) {
        const wrapper = document.createElement("div");
        wrapper.className = "concept-chart";
        
        const titleLower = normalizeStr(testTitle);
        let svgContent = "";

        // Cores do tema (pegando do CSS root se possível, ou hardcoded para garantir)
        const colorPrimary = "#8ab4f8";
        const colorSuccess = "#81c995";
        const colorDanger = "#f28b82";
        const colorMuted = "#5f6368";

        if (titleLower.includes("correlacao") || titleLower.includes("regressao")) {
            // --- GRÁFICO: SCATTERPLOT COM LINHA DE TENDÊNCIA ---
            // Define a direção: "pearson" cria uma visualização positiva (/), outros negativa (\)
            const isRising = titleLower.includes("pearson");
            
            let points = "";
            for(let i=0; i<25; i++) {
                const cx = 10 + Math.random() * 80; // 10% a 90%
                
                // Se isRising (visual positivo /): Y diminui conforme X aumenta (no SVG Y=0 é topo)
                // Se !isRising (visual negativo \): Y aumenta conforme X aumenta
                const trend = isRising ? (100 - cx) : cx; 
                
                const cy = trend + (Math.random() * 30 - 15); // Adiciona "ruído"
                points += `<circle cx="${cx}%" cy="${cy}%" r="3" fill="${colorPrimary}" opacity="0.7"/>`;
            }
            
            // Calcula linha de tendência para acompanhar os dados (10% a 90% do eixo X)
            // Se Rising: Vai de Y=90 (embaixo) para Y=10 (topo)
            // Se Falling: Vai de Y=10 (topo) para Y=90 (embaixo)
            const yStart = isRising ? 90 : 10;
            const yEnd = isRising ? 10 : 90;

            svgContent = `
                <svg class="concept-svg" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet">
                    <line x1="5" y1="95" x2="195" y2="95" stroke="${colorMuted}" stroke-width="1"/>
                    <line x1="5" y1="5" x2="5" y2="95" stroke="${colorMuted}" stroke-width="1"/>
                    
                    <g>${points}</g>
                    
                    <line x1="20" y1="${yStart}" x2="180" y2="${yEnd}" stroke="${colorDanger}" stroke-width="2" stroke-dasharray="5,5" opacity="0.8"/>
                </svg>
            `;

        } else if (titleLower.includes("comparacao") || titleLower.includes("t de student") || titleLower.includes("anova") || titleLower.includes("mann") || titleLower.includes("kruskal") || titleLower.includes("wilcoxon")) {
            // --- GRÁFICO: BOXPLOT / BARRAS COM ERRO ---
            // Desenha 2 ou 3 "distribuições" simplificadas (Violin/Box look)
            
            const isThree = titleLower.includes("anova") || titleLower.includes("kruskal");
            
            svgContent = `
                <svg class="concept-svg" viewBox="0 0 300 150">
                    <rect x="50" y="60" width="40" height="70" fill="${colorPrimary}" opacity="0.3" rx="4"/>
                    <line x1="70" y1="60" x2="70" y2="30" stroke="${colorPrimary}" stroke-width="2"/> <line x1="60" y1="30" x2="80" y2="30" stroke="${colorPrimary}" stroke-width="2"/> <circle cx="70" cy="60" r="4" fill="#fff"/> <text x="70" y="145" text-anchor="middle" fill="#ccc" font-size="12">G1</text>

                    <rect x="130" y="30" width="40" height="100" fill="${colorSuccess}" opacity="0.3" rx="4"/>
                    <line x1="150" y1="30" x2="150" y2="10" stroke="${colorSuccess}" stroke-width="2"/>
                    <line x1="140" y1="10" x2="160" y2="10" stroke="${colorSuccess}" stroke-width="2"/>
                    <circle cx="150" cy="40" r="4" fill="#fff"/>
                    <text x="150" y="145" text-anchor="middle" fill="#ccc" font-size="12">G2</text>

                    ${isThree ? `
                    <rect x="210" y="50" width="40" height="80" fill="${colorDanger}" opacity="0.3" rx="4"/>
                    <line x1="230" y1="50" x2="230" y2="25" stroke="${colorDanger}" stroke-width="2"/>
                    <line x1="220" y1="25" x2="240" y2="25" stroke="${colorDanger}" stroke-width="2"/>
                    <circle cx="230" cy="55" r="4" fill="#fff"/>
                    <text x="230" y="145" text-anchor="middle" fill="#ccc" font-size="12">G3</text>
                    ` : ''}
                    
                    <line x1="10" y1="130" x2="290" y2="130" stroke="${colorMuted}" stroke-width="1"/>
                </svg>
            `;

        } else if (titleLower.includes("normalidade") || titleLower.includes("shapiro")) {
            // --- GRÁFICO: CURVA NORMAL (GAUSSIANA) PERFEITA ---
            // Um Path SVG desenhando um sino suave
            svgContent = `
                <svg class="concept-svg" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet">
                     <path d="M0,90 C40,90 70,10 100,10 C130,10 160,90 200,90" fill="url(#grad1)" stroke="none"/>
                    
                    <path d="M0,90 C40,90 70,10 100,10 C130,10 160,90 200,90" fill="none" stroke="${colorSuccess}" stroke-width="2"/>
                    
                    <line x1="100" y1="10" x2="100" y2="90" stroke="#fff" stroke-dasharray="4,2" opacity="0.5"/>
                    
                    <defs>
                        <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:${colorSuccess};stop-opacity:0.4" />
                        <stop offset="100%" style="stop-color:${colorSuccess};stop-opacity:0" />
                        </linearGradient>
                    </defs>
                </svg>
            `;
        } else {
             return null;
        }
        
        wrapper.innerHTML = svgContent;
        return wrapper;
    }

    async function init() {
        setupEventListeners(); // Inicia listeners antes do fetch para garantir Home
        startFlowchart(); 
        try {
            const response = await fetch("data.json");
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            globalData = await response.json();
            renderSidebarList(globalData);
        } catch (error) { console.error(error); }
    }
    
    init();
});
