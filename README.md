# 📊 O *p* da questão

> **Guia Interativo de Análise Estatística & Gerador de Código R**

![Status](https://img.shields.io/badge/Status-Concluído-success)
![Linguagem](https://img.shields.io/badge/JavaScript-Vanilla-yellow)
![Foco](https://img.shields.io/badge/R-Statistics-blue)

**O *p* da questão** é um site desenvolvido para auxiliar pesquisadores na execução de testes estatísticos no R. Ele não só fornece o código de acordo com seus dados, mas também serve como um guia para boas práticas nessas análises, como a verificação dos pressupostos, representação visual e como reportar seus resultados.

## Origem
**O *p* da questão** surgiu num momento em que comecei a me dedicar a aprender mais sobre análises estatísticas no mundo da pesquisa, ao mesmo tempo que comecei a usar o R como principal software de análise (principalmente para transcriptômica).
Após participar da imersão DEV da Alura + Gemini, decidi compilar alguns dos códigos que fui aprendendo, bem como algumas boas práticas que normalmente me esqueceria.

A partir daí, criei algumas funcionalidades para que qualquer pessoa possa utilizar o R para essas análises de forma autonôma e segura. Basta saber o nome das suas variáveis presentes em sua tabela.

A ideia principal do site é ser um guia para sua análise e não somente te ensinar a ter o valor de p, até porque o valor de p é só umas das métricas que nos dizem algo sobre seu resultado. 

Eu espero que você encontre aqui uma boa ferramenta para se lembrar da teoria e aplicá-la aos seus dados!


---

## 🎯 Funcionalidades

O projeto transforma a teoria estatística em uma ferramenta prática e interativa:

* **Gerador de Código Personalizado:** Ao inserir os nomes das suas variáveis e do seu *dataframe*, o sistema atualiza automaticamente os scripts R (usando pacotes como `rstatix` e `ggpubr`), prontos para copiar e colar.
* **Guia de Boas Práticas:** Cada teste inclui uma seção dedicada à verificação de pressupostos (como normalidade e homocedasticidade) e alertas sobre o que fazer em caso de violação.
* **Árvore de Decisão (Modo Guiado):** Um fluxo de perguntas interativas que direciona o pesquisador ao teste adequado com base no objetivo do estudo e tipo de dados.
* **Modelos de Report:** Exemplos de texto padrão para descrever os resultados estatísticos em artigos científicos e teses.

## 🧪 Testes Estatísticos Disponíveis

A aplicação cobre os principais testes utilizados na pesquisa acadêmica, definidos na base de conhecimento do sistema:

* **Comparação de Médias:** Teste t de Student (Independente e Pareado), ANOVA One-Way.
* **Não-Paramétricos:** Mann-Whitney U, Wilcoxon Signed-Rank, Kruskal-Wallis.
* **Correlação e Regressão:** Pearson, Spearman, Regressão Linear Simples.
* **Associação:** Teste Qui-Quadrado de Independência.

## 🛠️ Tecnologias Utilizadas

O projeto foi construído utilizando tecnologias web padrão, garantindo leveza e facilidade de manutenção:

* **JavaScript (Vanilla):** Lógica de manipulação do DOM e geração dinâmica de código sem dependência de frameworks externos.
* **JSON:** Base de dados estruturada contendo as regras, descrições e snippets de código dos testes.
* **CSS3:** Estilização com tema escuro (*Dark Mode*) e layout responsivo.

## 🚀 Como rodar localmente

Este projeto utiliza a Fetch API para carregar os dados dos testes (`data.json`). Por políticas de segurança dos navegadores (CORS), ele precisa rodar em um servidor local.

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/TengFwu/NOME_DO_SEU_REPO.git](https://github.com/TengFwu/NOME_DO_SEU_REPO.git)
    ```

2.  **Inicie um servidor local:**
    * Se usar **VS Code**: Instale a extensão "Live Server", abra o arquivo `index.html` e clique em "Go Live".
    * Se usar **Python**:
        ```bash
        python -m http.server 8000
        ```

3.  **Acesse:** Abra `http://localhost:8000` no seu navegador.

---

### 👨‍💻 Autor

Desenvolvido por **Teng Fwu Shing**

[![Lattes](https://img.shields.io/badge/Lattes-CV-blue?style=flat&logo=sciencedirect)](http://lattes.cnpq.br/6506580608585044)
[![GitHub](https://img.shields.io/badge/GitHub-Profile-black?style=flat&logo=github)](https://github.com/TengFwu)
