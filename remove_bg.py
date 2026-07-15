from withoutbg import WithoutBG
import sys
import os

input_path = sys.argv[1]
output_path = sys.argv[2]

print(f"Loading withoutBG model...")
model = WithoutBG.open_weights()
print(f"Removing background from {input_path}...")
result = model.remove_background(input_path)
print(f"Saving to {output_path}...")
result.save(output_path)
print("Done!")
