import sys

def main():
    print("Hello from Python sidecar!")
    sys.stdout.flush()

    # Simple echo loop
    try:
        for line in sys.stdin:
            if not line:
                break
            print(f"Python received: {line.strip()}")
            sys.stdout.flush()
    except EOFError:
        pass

if __name__ == "__main__":
    main()
