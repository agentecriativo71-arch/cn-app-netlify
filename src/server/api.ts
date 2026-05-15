import { createServerFn } from '@tanstack/react-start';
import * as fal from '@fal-ai/serverless-client';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client for the server
const supabaseUrl = process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const _BODY_CHARS = {
  "Ampulheta": "shoulders and hips equally wide, waist dramatically narrower — clear X-shaped silhouette with balanced curves",
  "Triângulo": "hips visibly wider than shoulders, narrower upper body — triangular silhouette wider at the hips",
  "Triângulo Invertido": "shoulders broader than hips, V-shaped athletic upper body, narrower lower body",
  "Retângulo": "shoulders, waist and hips all nearly equal width with minimal waist curve — straight athletic silhouette",
  "Oval": "fuller rounded midsection as the widest part, shoulders and hips evenly rounded — soft round body with a fuller torso, NOT thin or slender",
};

export const generateCroquiFn = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: any }) => {
    const { peca, biotipo, comprimento, decote, manga } = data;
    
    let bodyContext = "";
    if (biotipo && _BODY_CHARS[biotipo as keyof typeof _BODY_CHARS]) {
      bodyContext = ` CRITICAL — the figure MUST have body type: ${_BODY_CHARS[biotipo as keyof typeof _BODY_CHARS]}. This is NOT a standard thin fashion illustration — the body shape described must be clearly visible with realistic proportions. Do NOT draw a slender model.`;
    }

    const garmentDetails = `A ${comprimento || ''} ${peca || 'garment'} with ${decote ? decote + ' neckline' : ''} and ${manga ? manga + ' sleeves' : ''}`;

    const prompt = `Professional fashion design croqui of ${garmentDetails}.${bodyContext}
CRITICAL: Show BOTH front view AND back view of the garment side by side in a single composition — front view on the left, back view on the right, as in professional fashion croquis.
The figure is a faceless fashion mannequin form — no facial features, no face detail, just a smooth featureless head or implied head shape. The focus is entirely on the garment.
Style: hand-drawn black pencil on white paper. Use hatching and cross-hatching for volume and shadow, directional strokes following the fabric grain to convey drape and texture, fine contour lines for garment structure, and stippling for any textured surfaces.
Clearly render garment construction details: seam lines, darts, stitch lines, closures, hemlines, and any decorative elements.
The back view must show closure details, back seam lines, and how the garment looks from behind.
No color, no photographs, no realistic rendering, no 3D, no shading gradients, no painted or digital look.
No text, no labels, no annotations, no watermarks, no faces, no facial features.`;

    try {
      const result: any = await fal.subscribe("fal-ai/bytedance/seedream/v4/text-to-image", {
        input: {
          prompt,
          image_size: "portrait_4_3",
          num_images: 1,
          enable_safety_checker: false,
        }
      });
      
      const imageUrl = result.images?.[0]?.url;
      if (!imageUrl) throw new Error("No image returned from Fal.ai");
      
      return { url: imageUrl };
    } catch (error) {
      console.error("[CROQUI] Error generating:", error);
      throw error;
    }
});

export const generateRealistaFn = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: any }) => {
    const { peca, cor, userImageUrl, croquiUrl, modo, biotipo, comprimento, decote, manga } = data;

    let result: any;

    if (modo === "foto") {
      if (!userImageUrl) {
          throw new Error("Foto do usuário é obrigatória para este passo.");
      }

      const prompt = `CRITICAL: Two reference images are provided.
The FIRST image shows a real person — preserve their exact face, identity, skin tone, hair, body shape, and natural pose with absolute fidelity. Do NOT alter their appearance.
The SECOND image shows a complete, ready-to-wear ${peca} as a finished garment (NOT a fabric swatch — this is the actual constructed garment).
Dress the person from the FIRST image in this exact ${peca} from the SECOND image.
Transfer the garment with precision: preserve its design, color (${cor}), silhouette, cut, and every construction detail.
The garment must drape naturally over the person's body, fitting their actual posture and proportions.
Keep the original background, lighting, and environment from the person's photo unchanged.
Result must look like a real editorial fashion photograph — photorealistic, sharp focus, high resolution.
The garment sits naturally on the body with realistic draping and proportions.
Do not add other people, do not change the subject's face or body.
No illustrations, no sketches, no cartoons.`;

      try {
        result = await fal.subscribe("fal-ai/bytedance/seedream/v4/edit", {
          input: {
            prompt,
            image_urls: [userImageUrl, croquiUrl],
            image_size: "square_hd",
            num_images: 1,
            enable_safety_checker: false,
          }
        });
      } catch (error) {
        console.error("[REALISTA FOTO] Error generating:", error);
        throw error;
      }
    } else {
      // Modo Manequim (apenas gera a foto realista da peça)
      let bodyContext = "";
      if (biotipo && _BODY_CHARS[biotipo as keyof typeof _BODY_CHARS]) {
        bodyContext = ` The mannequin must have ${_BODY_CHARS[biotipo as keyof typeof _BODY_CHARS]}. `;
      }
      
      const garmentDetails = `A ${comprimento || ''} ${peca || 'garment'} with ${decote ? decote + ' neckline' : ''} and ${manga ? manga + ' sleeves' : ''}`;
      
      const prompt = `Photorealistic professional fashion photograph of ${garmentDetails} in ${cor || 'a beautiful'} color, worn on a headless featureless dress mannequin, clean white studio background, soft diffused natural lighting, high resolution editorial fashion photo, sharp focus, real fabric texture clearly visible, professional fashion photography.${bodyContext}
No face, no person, just the mannequin with the garment. No text, no watermark, no illustration, no sketch, no cartoon. No flat drawing, no hands, no feet, no skin, no label, no annotation.`;

      try {
        result = await fal.subscribe("fal-ai/bytedance/seedream/v4/text-to-image", {
          input: {
            prompt,
            image_size: "portrait_4_3",
            num_images: 1,
            enable_safety_checker: false,
          }
        });
      } catch (error) {
        console.error("[REALISTA MANEQUIM] Error generating:", error);
        throw error;
      }
    }

    const imageUrl = result.images?.[0]?.url;
    if (!imageUrl) throw new Error("No image returned from Fal.ai");
    
    return { url: imageUrl };
});

export const saveLookDbFn = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: any }) => {
    try {
      const { data: dbData, error } = await supabase
        .from('looks')
        .insert([data])
        .select('id')
        .single();
        
      if (error) throw error;
      return { id: dbData.id };
    } catch (error) {
      console.error("[DB] Error saving look:", error);
      throw error;
    }
});

export const updateLookDbFn = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: { id: string; update: any } }) => {
    try {
      const { error } = await supabase
        .from('looks')
        .update(data.update)
        .eq('id', data.id);
        
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("[DB] Error updating look:", error);
      throw error;
    }
});
