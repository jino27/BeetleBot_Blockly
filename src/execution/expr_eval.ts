export interface Scope {
  [key: string]: number | boolean | string | undefined;
}

type TokenType =
  | "NUMBER"
  | "STRING"
  | "IDENTIFIER"
  | "TRUE"
  | "FALSE"
  | "PLUS"
  | "MINUS"
  | "MULTIPLY"
  | "DIVIDE"
  | "MODULO"
  | "LT"
  | "GT"
  | "LTE"
  | "GTE"
  | "EQ"
  | "NEQ"
  | "AND"
  | "OR"
  | "NOT"
  | "LPAREN"
  | "RPAREN"
  | "EOF";

interface Token {
  type: TokenType;
  value?: string | number;
}

class Lexer {
  private input: string;
  private pos: number = 0;

  constructor(input: string) {
    this.input = input;
  }

  private peek(): string {
    return this.input[this.pos] || "\0";
  }

  private advance(): string {
    return this.input[this.pos++] || "\0";
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.peek())) {
      this.advance();
    }
  }

  nextToken(): Token {
    this.skipWhitespace();

    const ch = this.peek();

    if (ch === "\0") {
      return { type: "EOF" };
    }

    if (ch === "+") {
      this.advance();
      return { type: "PLUS" };
    }
    if (ch === "-") {
      this.advance();
      return { type: "MINUS" };
    }
    if (ch === "*") {
      this.advance();
      return { type: "MULTIPLY" };
    }
    if (ch === "/") {
      this.advance();
      return { type: "DIVIDE" };
    }
    if (ch === "%") {
      this.advance();
      return { type: "MODULO" };
    }
    if (ch === "(") {
      this.advance();
      return { type: "LPAREN" };
    }
    if (ch === ")") {
      this.advance();
      return { type: "RPAREN" };
    }
    if (ch === "!") {
      this.advance();
      if (this.peek() === "=") {
        this.advance();
        return { type: "NEQ" };
      }
      return { type: "NOT" };
    }
    if (ch === "<") {
      this.advance();
      if (this.peek() === "=") {
        this.advance();
        return { type: "LTE" };
      }
      return { type: "LT" };
    }
    if (ch === ">") {
      this.advance();
      if (this.peek() === "=") {
        this.advance();
        return { type: "GTE" };
      }
      return { type: "GT" };
    }
    if (ch === "=") {
      this.advance();
      if (this.peek() === "=") {
        this.advance();
        return { type: "EQ" };
      }
      throw new Error("Unexpected character: = (use == for equality)");
    }
    if (ch === "&") {
      this.advance();
      if (this.peek() === "&") {
        this.advance();
        return { type: "AND" };
      }
      throw new Error("Unexpected character: & (use && for logical AND)");
    }
    if (ch === "|") {
      this.advance();
      if (this.peek() === "|") {
        this.advance();
        return { type: "OR" };
      }
      throw new Error("Unexpected character: | (use || for logical OR)");
    }

    if (/\d/.test(ch)) {
      let numStr = "";
      while (/\d/.test(this.peek())) {
        numStr += this.advance();
      }
      if (this.peek() === ".") {
        numStr += this.advance();
        while (/\d/.test(this.peek())) {
          numStr += this.advance();
        }
      }
      return { type: "NUMBER", value: parseFloat(numStr) };
    }

    if (ch === '"' || ch === "'") {
      const quote = this.advance();
      let str = "";
      while (this.peek() !== quote && this.peek() !== "\0") {
        str += this.advance();
      }
      if (this.peek() === "\0") {
        throw new Error("Unterminated string");
      }
      this.advance();
      return { type: "STRING", value: str };
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let ident = "";
      while (/[a-zA-Z0-9_]/.test(this.peek())) {
        ident += this.advance();
      }
      if (ident === "true") return { type: "TRUE" };
      if (ident === "false") return { type: "FALSE" };
      return { type: "IDENTIFIER", value: ident };
    }

    throw new Error(`Unexpected character: ${ch}`);
  }
}

abstract class ASTNode {
  abstract evaluate(scope: Scope): number | boolean | string;
}

class LiteralNode extends ASTNode {
  constructor(public value: number | boolean | string) {
    super();
  }
  evaluate(): number | boolean | string {
    return this.value;
  }
}

class VariableNode extends ASTNode {
  constructor(public name: string) {
    super();
  }
  evaluate(scope: Scope): number | boolean | string {
    const value = scope[this.name];
    if (value === undefined) {
      throw new Error(`Undefined variable: ${this.name}`);
    }
    return value;
  }
}

class BinaryOpNode extends ASTNode {
  constructor(
    public left: ASTNode,
    public operator: TokenType,
    public right: ASTNode
  ) {
    super();
  }

  evaluate(scope: Scope): number | boolean | string {
    const leftVal = this.left.evaluate(scope);
    const rightVal = this.right.evaluate(scope);

    switch (this.operator) {
      case "PLUS":
        return (leftVal as number) + (rightVal as number);
      case "MINUS":
        return (leftVal as number) - (rightVal as number);
      case "MULTIPLY":
        return (leftVal as number) * (rightVal as number);
      case "DIVIDE":
        return (leftVal as number) / (rightVal as number);
      case "MODULO":
        return (leftVal as number) % (rightVal as number);
      case "LT":
        return (leftVal as number) < (rightVal as number);
      case "GT":
        return (leftVal as number) > (rightVal as number);
      case "LTE":
        return (leftVal as number) <= (rightVal as number);
      case "GTE":
        return (leftVal as number) >= (rightVal as number);
      case "EQ":
        return leftVal === rightVal;
      case "NEQ":
        return leftVal !== rightVal;
      case "AND":
        return (leftVal as boolean) && (rightVal as boolean);
      case "OR":
        return (leftVal as boolean) || (rightVal as boolean);
      default:
        throw new Error(`Unknown binary operator: ${this.operator}`);
    }
  }
}

class UnaryOpNode extends ASTNode {
  constructor(public operator: TokenType, public operand: ASTNode) {
    super();
  }

  evaluate(scope: Scope): number | boolean | string {
    const val = this.operand.evaluate(scope);
    switch (this.operator) {
      case "MINUS":
        return -(val as number);
      case "PLUS":
        return +(val as number);
      case "NOT":
        return !(val as boolean);
      default:
        throw new Error(`Unknown unary operator: ${this.operator}`);
    }
  }
}

class Parser {
  private lexer: Lexer;
  private currentToken: Token;

  constructor(input: string) {
    this.lexer = new Lexer(input);
    this.currentToken = this.lexer.nextToken();
  }

  private eat(tokenType: TokenType): void {
    if (this.currentToken.type === tokenType) {
      this.currentToken = this.lexer.nextToken();
    } else {
      throw new Error(
        `Expected ${tokenType}, got ${this.currentToken.type}`
      );
    }
  }

  parse(): ASTNode {
    const node = this.parseExpression();
    if (this.currentToken.type !== "EOF") {
      throw new Error("Unexpected token after expression");
    }
    return node;
  }

  private parseExpression(): ASTNode {
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): ASTNode {
    let node = this.parseLogicalAnd();
    while (this.currentToken.type === "OR") {
      const op = this.currentToken.type;
      this.eat("OR");
      node = new BinaryOpNode(node, op, this.parseLogicalAnd());
    }
    return node;
  }

  private parseLogicalAnd(): ASTNode {
    let node = this.parseEquality();
    while (this.currentToken.type === "AND") {
      const op = this.currentToken.type;
      this.eat("AND");
      node = new BinaryOpNode(node, op, this.parseEquality());
    }
    return node;
  }

  private parseEquality(): ASTNode {
    let node = this.parseComparison();
    while (
      this.currentToken.type === "EQ" ||
      this.currentToken.type === "NEQ"
    ) {
      const op = this.currentToken.type;
      this.eat(op);
      node = new BinaryOpNode(node, op, this.parseComparison());
    }
    return node;
  }

  private parseComparison(): ASTNode {
    let node = this.parseTerm();
    while (
      this.currentToken.type === "LT" ||
      this.currentToken.type === "GT" ||
      this.currentToken.type === "LTE" ||
      this.currentToken.type === "GTE"
    ) {
      const op = this.currentToken.type;
      this.eat(op);
      node = new BinaryOpNode(node, op, this.parseTerm());
    }
    return node;
  }

  private parseTerm(): ASTNode {
    let node = this.parseFactor();
    while (
      this.currentToken.type === "PLUS" ||
      this.currentToken.type === "MINUS"
    ) {
      const op = this.currentToken.type;
      this.eat(op);
      node = new BinaryOpNode(node, op, this.parseFactor());
    }
    return node;
  }

  private parseFactor(): ASTNode {
    let node = this.parseUnary();
    while (
      this.currentToken.type === "MULTIPLY" ||
      this.currentToken.type === "DIVIDE" ||
      this.currentToken.type === "MODULO"
    ) {
      const op = this.currentToken.type;
      this.eat(op);
      node = new BinaryOpNode(node, op, this.parseUnary());
    }
    return node;
  }

  private parseUnary(): ASTNode {
    if (
      this.currentToken.type === "MINUS" ||
      this.currentToken.type === "PLUS" ||
      this.currentToken.type === "NOT"
    ) {
      const op = this.currentToken.type;
      this.eat(op);
      return new UnaryOpNode(op, this.parseUnary());
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    const token = this.currentToken;

    if (token.type === "NUMBER") {
      this.eat("NUMBER");
      return new LiteralNode(token.value as number);
    }

    if (token.type === "STRING") {
      this.eat("STRING");
      return new LiteralNode(token.value as string);
    }

    if (token.type === "TRUE") {
      this.eat("TRUE");
      return new LiteralNode(true);
    }

    if (token.type === "FALSE") {
      this.eat("FALSE");
      return new LiteralNode(false);
    }

    if (token.type === "IDENTIFIER") {
      this.eat("IDENTIFIER");
      return new VariableNode(token.value as string);
    }

    if (token.type === "LPAREN") {
      this.eat("LPAREN");
      const node = this.parseExpression();
      this.eat("RPAREN");
      return node;
    }

    throw new Error(`Unexpected token: ${token.type}`);
  }
}

export function evalExpr(expr: string, scope: Scope): boolean | number | string {
  const parser = new Parser(expr);
  const ast = parser.parse();
  return ast.evaluate(scope);
}