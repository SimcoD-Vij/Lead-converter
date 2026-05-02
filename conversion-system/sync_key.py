import os
import json

def update_env():
    if not os.path.exists("config.json"):
        print("config.json not found")
        return
        
    with open("config.json", "r") as f:
        config = json.load(f)
        
    if not os.path.exists(".env"):
        print(".env not found")
        return
        
    with open(".env", "r") as f:
        lines = f.readlines()
        
    new_lines = []
    updated_keys = set()
    
    for line in lines:
        matched = False
        for key in config:
            if line.startswith(f"{key}="):
                new_lines.append(f"{key}={config[key]}\n")
                updated_keys.add(key)
                matched = True
                break
        if not matched:
            new_lines.append(line)
            
    with open(".env", "w") as f:
        f.writelines(new_lines)
                
    print(f"Successfully updated in .env: {', '.join(updated_keys)}")

if __name__ == "__main__":
    update_env()
