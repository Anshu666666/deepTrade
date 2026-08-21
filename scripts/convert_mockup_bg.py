import os
import glob
import time
from PIL import Image
import numpy as np
import scipy.ndimage as ndi

def process_single_frame(file_path, tolerance=35):
    try:
        img = Image.open(file_path).convert('RGBA')
        arr = np.array(img)
        h, w, _ = arr.shape
        rgb = arr[:, :, :3].astype(np.float32)
        
        # Sample corner/border background colors
        bg_samples = np.vstack([
            rgb[0, :], rgb[-1, :], rgb[:, 0], rgb[:, -1]
        ])
        bg_mean = np.mean(bg_samples, axis=0)
        
        # Distance to background
        dist = np.sqrt(np.sum((rgb - bg_mean)**2, axis=2))
        
        # Binary mask where color matches background
        bg_candidates = (dist < tolerance)
        
        # Connected component labeling with scipy.ndimage (fast C implementation)
        labeled, num_features = ndi.label(bg_candidates)
        
        # Find which label(s) touch the image border
        border_labels = set()
        border_labels.update(np.unique(labeled[0, :]))
        border_labels.update(np.unique(labeled[-1, :]))
        border_labels.update(np.unique(labeled[:, 0]))
        border_labels.update(np.unique(labeled[:, -1]))
        border_labels.discard(0) # 0 is foreground
        
        # Mask of all components connected to border
        is_bg = np.isin(labeled, list(border_labels))
        
        # Set outer background to pure black (0, 0, 0, 255)
        out_arr = arr.copy()
        out_arr[is_bg, 0] = 0
        out_arr[is_bg, 1] = 0
        out_arr[is_bg, 2] = 0
        out_arr[is_bg, 3] = 255
        
        out_img = Image.fromarray(out_arr)
        out_img.save(file_path, quality=95)
        return True
    except Exception as e:
        print(f"✗ Failed {file_path}: {e}")
        return False

def main():
    mockup_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "ui", "src", "assets", "Mockups", "IphoneMockup")
    files = sorted(glob.glob(os.path.join(mockup_dir, "*.png")))
    print(f"Found {len(files)} frames to convert in {mockup_dir}...")
    
    t0 = time.time()
    count = 0
    for idx, f in enumerate(files, 1):
        if process_single_frame(f):
            count += 1
        if idx % 10 == 0 or idx == len(files):
            print(f"[{idx}/{len(files)}] frames converted... ({time.time()-t0:.1f}s elapsed)")
        
    print(f"\nDone! Successfully converted {count}/{len(files)} frames to pure black background in {time.time()-t0:.2f}s.")

if __name__ == "__main__":
    main()
