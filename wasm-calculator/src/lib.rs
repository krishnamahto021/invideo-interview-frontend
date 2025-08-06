use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
    
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen]
pub fn calculate(expression: &str) -> Result<f64, JsValue> {
    console_log!("Calculating: {}", expression);
    
    match evaluate_expression(expression) {
        Ok(result) => {
            console_log!("Result: {}", result);
            Ok(result)
        }
        Err(e) => {
            console_log!("Error: {}", e);
            Err(JsValue::from_str(&e))
        }
    }
}

fn evaluate_expression(expr: &str) -> Result<f64, String> {
    let expr = expr.replace(" ", "");
    
    if expr.is_empty() {
        return Err("Empty expression".to_string());
    }
    
    // Simple recursive descent parser for basic arithmetic
    let mut tokens = tokenize(&expr)?;
    let result = parse_expression(&mut tokens)?;
    
    if !tokens.is_empty() {
        return Err("Unexpected tokens at end of expression".to_string());
    }
    
    Ok(result)
}

#[derive(Debug, Clone)]
enum Token {
    Number(f64),
    Plus,
    Minus,
    Multiply,
    Divide,
    LeftParen,
    RightParen,
}

fn tokenize(expr: &str) -> Result<Vec<Token>, String> {
    let mut tokens = Vec::new();
    let mut chars = expr.chars().peekable();
    
    while let Some(&ch) = chars.peek() {
        match ch {
            '0'..='9' | '.' => {
                let mut number = String::new();
                while let Some(&ch) = chars.peek() {
                    if ch.is_ascii_digit() || ch == '.' {
                        number.push(chars.next().unwrap());
                    } else {
                        break;
                    }
                }
                match number.parse::<f64>() {
                    Ok(n) => tokens.push(Token::Number(n)),
                    Err(_) => return Err(format!("Invalid number: {}", number)),
                }
            }
            '+' => {
                tokens.push(Token::Plus);
                chars.next();
            }
            '-' => {
                tokens.push(Token::Minus);
                chars.next();
            }
            '*' => {
                tokens.push(Token::Multiply);
                chars.next();
            }
            '/' => {
                tokens.push(Token::Divide);
                chars.next();
            }
            '(' => {
                tokens.push(Token::LeftParen);
                chars.next();
            }
            ')' => {
                tokens.push(Token::RightParen);
                chars.next();
            }
            _ => return Err(format!("Unexpected character: {}", ch)),
        }
    }
    
    Ok(tokens)
}

fn parse_expression(tokens: &mut Vec<Token>) -> Result<f64, String> {
    let mut result = parse_term(tokens)?;
    
    while !tokens.is_empty() {
        match &tokens[0] {
            Token::Plus => {
                tokens.remove(0);
                result += parse_term(tokens)?;
            }
            Token::Minus => {
                tokens.remove(0);
                result -= parse_term(tokens)?;
            }
            _ => break,
        }
    }
    
    Ok(result)
}

fn parse_term(tokens: &mut Vec<Token>) -> Result<f64, String> {
    let mut result = parse_factor(tokens)?;
    
    while !tokens.is_empty() {
        match &tokens[0] {
            Token::Multiply => {
                tokens.remove(0);
                result *= parse_factor(tokens)?;
            }
            Token::Divide => {
                tokens.remove(0);
                let divisor = parse_factor(tokens)?;
                if divisor == 0.0 {
                    return Err("Division by zero".to_string());
                }
                result /= divisor;
            }
            _ => break,
        }
    }
    
    Ok(result)
}

fn parse_factor(tokens: &mut Vec<Token>) -> Result<f64, String> {
    if tokens.is_empty() {
        return Err("Unexpected end of expression".to_string());
    }
    
    match tokens.remove(0) {
        Token::Number(n) => Ok(n),
        Token::Minus => {
            let factor = parse_factor(tokens)?;
            Ok(-factor)
        }
        Token::Plus => parse_factor(tokens),
        Token::LeftParen => {
            let result = parse_expression(tokens)?;
            if tokens.is_empty() || !matches!(tokens[0], Token::RightParen) {
                return Err("Missing closing parenthesis".to_string());
            }
            tokens.remove(0); // Remove the closing parenthesis
            Ok(result)
        }
        _ => Err("Unexpected token".to_string()),
    }
}
