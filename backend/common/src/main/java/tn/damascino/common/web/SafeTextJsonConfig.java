package tn.damascino.common.web;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonStreamContext;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdScalarDeserializer;
import com.fasterxml.jackson.databind.deser.std.StringDeserializer;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;

/**
 * Applies {@link SafeText} to every string of every JSON request body, in every service: invisible characters are
 * removed and markup is refused (400 VALIDATION_ERROR on the field). Secret fields are left untouched.
 */
@Configuration
public class SafeTextJsonConfig {

    @Bean
    public SimpleModule safeTextModule() {
        return new SimpleModule("safe-text").addDeserializer(String.class, new SafeStringDeserializer());
    }

    static final class SafeStringDeserializer extends StdScalarDeserializer<String> {

        SafeStringDeserializer() {
            super(String.class);
        }

        @Override
        public String deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
            String value = StringDeserializer.instance.deserialize(p, ctxt);
            String field = fieldName(p);
            if (value == null || SafeText.isSecretField(field)) {
                return value;
            }
            if (SafeText.containsMarkup(value)) {
                throw new SafeText.UnsafeTextException(field);
            }
            return SafeText.stripInvisible(value);
        }

        /** Name of the property being read, also for the elements of a list property. */
        private static String fieldName(JsonParser p) {
            for (JsonStreamContext context = p.getParsingContext(); context != null; context = context.getParent()) {
                if (context.getCurrentName() != null) {
                    return context.getCurrentName();
                }
            }
            return null;
        }
    }
}
